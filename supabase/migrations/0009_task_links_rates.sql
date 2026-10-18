-- Real task links (parent + dependencies) and per-entry billing/costing rates

-- parent task
alter table public.project_tasks add column if not exists parent_task_id uuid references public.project_tasks(id) on delete set null;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='project_tasks' and column_name='parent_task') then
    update public.project_tasks c set parent_task_id = p.id
      from public.project_tasks p
      where c.parent_task_id is null and c.parent_task is not null and c.parent_task <> ''
        and (p.code = c.parent_task or p.subject = c.parent_task) and p.id <> c.id;
    alter table public.project_tasks drop column parent_task;
  end if;
end $$;
create index if not exists idx_tasks_parent on public.project_tasks(parent_task_id);

-- dependencies
create table if not exists public.task_dependencies (
  task_id       uuid not null references public.project_tasks(id) on delete cascade,
  depends_on_id uuid not null references public.project_tasks(id) on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);
create index if not exists idx_task_deps_on on public.task_dependencies(depends_on_id);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='project_tasks' and column_name='dependencies') then
    insert into public.task_dependencies (task_id, depends_on_id)
      select t.id, d.id
      from public.project_tasks t,
           lateral jsonb_array_elements(t.dependencies) e,
           public.project_tasks d
      where jsonb_typeof(t.dependencies) = 'array'
        and d.code = e->>'taskId' and d.id <> t.id
      on conflict do nothing;
    alter table public.project_tasks drop column dependencies;
  end if;
end $$;

alter table public.task_dependencies enable row level security;
revoke all on public.task_dependencies from anon;
grant select, insert, update, delete on public.task_dependencies to authenticated;
drop policy if exists task_dependencies_all on public.task_dependencies;
create policy task_dependencies_all on public.task_dependencies for all to authenticated using (true) with check (true);
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='task_dependencies') then
    alter publication supabase_realtime add table public.task_dependencies;
  end if;
end $$;

-- rates on entries
alter table public.timesheet_entries add column if not exists billing_rate numeric(14,2);
alter table public.timesheet_entries add column if not exists costing_rate numeric(14,2);

-- Resolve rates: activity_costs (employee + activity) > activity_types > pm_settings defaults
create or replace function public.resolve_entry_rates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  emp text;
  b numeric; c numeric;
begin
  if new.billing_rate is not null and new.costing_rate is not null then
    return new;
  end if;

  select employee into emp from public.timesheets where id = new.timesheet_id;

  select ac.billing_rate, ac.costing_rate into b, c
    from public.activity_costs ac
    join public.activity_types a on a.id = ac.activity_type_id
   where a.name = new.activity_type and lower(coalesce(ac.employee,'')) = lower(coalesce(emp,''))
   limit 1;

  if b is null then
    select billing_rate, costing_rate into b, c from public.activity_types where name = new.activity_type;
  end if;
  if b is null then
    select default_billing_rate, default_costing_rate into b, c from public.pm_settings limit 1;
  end if;

  new.billing_rate := coalesce(new.billing_rate, b, 0);
  new.costing_rate := coalesce(new.costing_rate, c, 0);
  return new;
end $$;

drop trigger if exists trg_entries_rates on public.timesheet_entries;
create trigger trg_entries_rates before insert or update on public.timesheet_entries
  for each row execute function public.resolve_entry_rates();

create or replace function public.recalc_timesheet_totals()
returns trigger language plpgsql as $$
declare
  ts uuid := coalesce(new.timesheet_id, old.timesheet_id);
  total numeric; billable numeric; bamt numeric; camt numeric;
begin
  select coalesce(sum(hours),0),
         coalesce(sum(hours) filter (where is_billable),0),
         coalesce(sum(hours * billing_rate) filter (where is_billable),0),
         coalesce(sum(hours * costing_rate),0)
    into total, billable, bamt, camt
    from public.timesheet_entries where timesheet_id = ts;
  update public.timesheets
     set total_working_hours   = total,
         total_billable_hours  = billable,
         total_billable_amount = bamt,
         total_costing_amount  = camt
   where id = ts;
  return null;
end $$;

-- Re-resolve rates for existing rows (fires the triggers)
update public.timesheet_entries set billing_rate = null, costing_rate = null;
