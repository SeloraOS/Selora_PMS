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
      'companies','holiday_lists','holidays','project_updates','pm_settings','profiles']) t
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

  raise notice 'verify.sql: all checks passed';
end $$;
