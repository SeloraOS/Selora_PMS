-- Read-only database verification. Raises an exception listing the first failing check.
-- Run: ssh oracle "docker exec -i supabase-pms-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < supabase/verify.sql
do $$
declare
  n int;
  msg text;
begin
  -- every public table has a primary key
  select string_agg(c.relname, ', ') into msg from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     and not exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'p');
  if msg is not null then raise exception 'tables without primary key: %', msg; end if;

  -- every foreign key column is indexed (leading column)
  select string_agg(c.conrelid::regclass || '.' || a.attname, ', ') into msg
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
     and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]);
  if msg is not null then raise exception 'foreign keys without index: %', msg; end if;

  -- row level security on, anon without grants
  select string_agg(tablename, ', ') into msg from pg_tables where schemaname = 'public' and not rowsecurity;
  if msg is not null then raise exception 'tables without RLS: %', msg; end if;
  select count(*) into n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
  if n > 0 then raise exception 'anon has % grants on public tables', n; end if;

  -- realtime publication covers every table the app watches
  select string_agg(t, ', ') into msg from unnest(array[
      'projects','project_tasks','task_dependencies','timesheets','timesheet_entries','project_users',
      'project_types','activity_types','activity_costs','project_templates','project_template_tasks',
      'companies','holiday_lists','holidays','project_updates','pm_settings','profiles','attachments','comments']) t
   where not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t);
  if msg is not null then raise exception 'not in realtime publication: %', msg; end if;

  -- codes
  select count(*) into n from (
    select code from public.projects group by code having count(*) > 1 union all
    select code from public.project_tasks group by code having count(*) > 1 union all
    select code from public.timesheets group by code having count(*) > 1) d;
  if n > 0 then raise exception 'duplicate document codes'; end if;
  select (select count(*) from public.projects where code is null) + (select count(*) from public.project_tasks where code is null)
       + (select count(*) from public.timesheets where code is null) into n;
  if n > 0 then raise exception '% rows without a document code', n; end if;

  -- task graph: parents in the same project, no parent loops, no dependency loops, no self links
  select count(*) into n from public.project_tasks c join public.project_tasks p on p.id = c.parent_task_id
   where c.project_id is distinct from p.project_id;
  if n > 0 then raise exception '% tasks have a parent in another project', n; end if;
  select count(*) into n from public.project_tasks where parent_task_id = id;
  if n > 0 then raise exception '% tasks are their own parent', n; end if;
  select count(*) into n from (
    with recursive walk(start_id, id, depth) as (
      select id, parent_task_id, 1 from public.project_tasks where parent_task_id is not null
      union all
      select w.start_id, t.parent_task_id, w.depth + 1 from walk w join public.project_tasks t on t.id = w.id
       where t.parent_task_id is not null and w.depth < 50)
    select 1 from walk where id = start_id) x;
  if n > 0 then raise exception 'parent task loops exist'; end if;
  select count(*) into n from (
    with recursive walk(start_id, id, depth) as (
      select task_id, depends_on_id, 1 from public.task_dependencies
      union all
      select w.start_id, d.depends_on_id, w.depth + 1 from walk w join public.task_dependencies d on d.task_id = w.id where w.depth < 50)
    select 1 from walk where id = start_id) x;
  if n > 0 then raise exception 'dependency cycles exist'; end if;

  -- timesheet totals equal the sum of their entries
  select count(*) into n from public.timesheets t
   where t.total_working_hours  <> coalesce((select sum(hours) from public.timesheet_entries e where e.timesheet_id = t.id), 0)
      or t.total_billable_amount <> coalesce((select sum(hours * billing_rate) from public.timesheet_entries e where e.timesheet_id = t.id and e.is_billable), 0)
      or t.total_costing_amount  <> coalesce((select sum(hours * costing_rate) from public.timesheet_entries e where e.timesheet_id = t.id), 0);
  if n > 0 then raise exception '% timesheets have totals that differ from their entries', n; end if;
  select count(*) into n from public.timesheet_entries where billing_rate is null or costing_rate is null;
  if n > 0 then raise exception '% entries without resolved rates', n; end if;

  -- relations that must resolve
  select count(*) into n from public.projects where company not in (select name from public.companies);
  if n > 0 then raise exception '% projects with unknown company', n; end if;
  select count(*) into n from public.project_users u where not exists (select 1 from public.projects p where p.id = u.project_id);
  if n > 0 then raise exception 'orphan project users'; end if;

  -- phase 1: private file bucket, audit triggers, access helpers
  select count(*) into n from storage.buckets where id = 'project-files' and not public;
  if n <> 1 then raise exception 'storage bucket project-files must exist and be private'; end if;
  select string_agg(t, ', ') into msg from unnest(array['projects','project_tasks','timesheets','project_updates','project_users','pm_settings','profiles','attachments']) t
   where not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t)::regclass and g.tgname = 'trg_' || t || '_audit');
  if msg is not null then raise exception 'missing audit triggers on: %', msg; end if;
  select string_agg(f, ', ') into msg from unnest(array['can_access_project','is_staff','is_internal','is_external','current_app_role','my_project_role']) f
   where not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = f);
  if msg is not null then raise exception 'missing access helper functions: %', msg; end if;
  -- external roles must never be able to read internal cost data (policies reference is_internal)
  select string_agg(tablename, ', ') into msg from pg_policies
   where schemaname = 'public' and tablename in ('timesheets','timesheet_entries','activity_types','activity_costs','pm_settings') and cmd in ('SELECT','ALL')
     and qual not like '%is_internal%' and qual not like '%current_role_is%';
  if msg is not null then raise exception 'cost tables readable by external roles: %', msg; end if;

  -- phase 2: site tables are secured, audited and realtime
  select string_agg(t, ', ') into msg from unnest(array['trades','snag_categories','daily_reports','daily_report_work','daily_report_manpower','snags','approvals']) t
   where not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t);
  if msg is not null then raise exception 'site tables missing from realtime: %', msg; end if;
  select string_agg(t, ', ') into msg from unnest(array['daily_reports','snags','approvals']) t
   where not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t)::regclass and g.tgname = 'trg_' || t || '_audit');
  if msg is not null then raise exception 'missing audit triggers on: %', msg; end if;
  select count(*) into n from public.approvals where approved_on is not null and applied_on is not null and approved_on < applied_on;
  if n > 0 then raise exception 'approvals approved before applied'; end if;
  select count(*) into n from public.daily_report_work w join public.daily_reports r on r.id = w.report_id join public.project_tasks t on t.id = w.task_id where t.project_id <> r.project_id;
  if n > 0 then raise exception 'daily report work lines on tasks of another project'; end if;
  select count(*) into n from public.pm_settings where approval_warning_days < 1 or snag_default_due_days < 1;
  if n > 0 then raise exception 'invalid site settings'; end if;

  -- phase 3: finance tables secured, audited, realtime; money math consistent
  select string_agg(t, ', ') into msg from unnest(array['cost_heads','vendors','budgets','budget_revisions','work_orders','ra_bills','payments','material_requests']) t
   where not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t);
  if msg is not null then raise exception 'finance tables missing from realtime: %', msg; end if;
  select string_agg(t, ', ') into msg from unnest(array['vendors','budgets','work_orders','ra_bills','payments','material_requests']) t
   where not exists (select 1 from pg_trigger g where g.tgrelid = ('public.' || t)::regclass and g.tgname = 'trg_' || t || '_audit');
  if msg is not null then raise exception 'missing audit triggers on: %', msg; end if;
  select count(*) into n from public.ra_bills where net_amount <> gross_amount + gst_amount - retention_amount - tds_amount or paid_amount > net_amount;
  if n > 0 then raise exception '% bills with inconsistent amounts', n; end if;
  select count(*) into n from public.ra_bills b where paid_amount <> coalesce((select sum(amount) from public.payments p where p.bill_id = b.id), 0);
  if n > 0 then raise exception '% bills whose paid_amount differs from their payments', n; end if;
  select count(*) into n from public.work_orders w where w.amount < coalesce((select sum(gross_amount) from public.ra_bills b where b.work_order_id = w.id and b.status <> 'rejected'), 0);
  if n > 0 then raise exception '% work orders billed above their value', n; end if;
  select count(*) into n from public.ra_bills b join public.work_orders w on w.id = b.work_order_id where b.project_id <> w.project_id or b.vendor_id <> w.vendor_id;
  if n > 0 then raise exception 'bills whose project or vendor differs from their work order'; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename in ('vendors','budgets','work_orders','ra_bills','payments','material_requests','cost_heads') and roles::text like '%anon%';
  if n > 0 then raise exception 'finance policies must not apply to anon'; end if;

  raise notice 'verify.sql: all checks passed';
end $$;
