-- Integrity: FK indexes, value checks, company/activity relations, immutable codes, cycle protection

-- 1. Indexes on created_by foreign keys
do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets','project_types','activity_types',
                           'activity_costs','project_templates','project_updates'] loop
    execute format('create index if not exists idx_%1$s_created_by on public.%1$s(created_by)', t);
  end loop;
end $$;

-- 2. Company is a relation (companies.name). Fix the legacy 'Selora' default first.
insert into public.companies (name)
  select distinct c from (
    select company c from public.projects union select company from public.project_tasks
    union select company from public.timesheets union select company from public.pm_settings
  ) x where c is not null and c <> '' and c <> 'Selora'
on conflict (name) do nothing;
update public.project_tasks set company = 'Selora Realty' where company is null or company = 'Selora';
update public.timesheets    set company = 'Selora Realty' where company is null or company = 'Selora';
update public.projects      set company = 'Selora Realty' where company is null or company = 'Selora';
alter table public.project_tasks alter column company set default 'Selora Realty';
alter table public.timesheets    alter column company set default 'Selora Realty';
alter table public.projects      alter column company set default 'Selora Realty';

do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets','pm_settings'] loop
    execute format('alter table public.%1$s drop constraint if exists %1$s_company_fkey', t);
    execute format('alter table public.%1$s add constraint %1$s_company_fkey foreign key (company)
                    references public.companies(name) on update cascade on delete restrict', t);
  end loop;
end $$;

-- 3. Timesheet entry activity is a relation (activity_types.name)
alter table public.timesheet_entries drop constraint if exists timesheet_entries_activity_type_fkey;
alter table public.timesheet_entries add constraint timesheet_entries_activity_type_fkey
  foreign key (activity_type) references public.activity_types(name) on update cascade on delete set null;

-- 4. Value checks (lists match the UI option lists)
do $do$
declare
  c record;
begin
  for c in select * from (values
    ('projects','projects_status_chk',        $$status in ('Open','Completed','Cancelled')$$),
    ('projects','projects_priority_chk',      $$priority in ('Low','Medium','High','Urgent')$$),
    ('projects','projects_cost_chk',          $$estimated_cost is null or estimated_cost >= 0$$),
    ('projects','projects_expected_dates_chk',$$expected_start_date is null or expected_end_date is null or expected_end_date >= expected_start_date$$),
    ('projects','projects_actual_dates_chk',  $$actual_start_date is null or actual_end_date is null or actual_end_date >= actual_start_date$$),
    ('project_tasks','tasks_status_chk',      $$status in ('Open','Working','Pending','Overdue','Completed','Cancelled')$$),
    ('project_tasks','tasks_priority_chk',    $$priority in ('Low','Medium','High','Urgent')$$),
    ('project_tasks','tasks_weight_chk',      $$weight is null or (weight >= 0 and weight <= 100)$$),
    ('project_tasks','tasks_expected_dates_chk',$$expected_start_date is null or expected_end_date is null or expected_end_date >= expected_start_date$$),
    ('project_tasks','tasks_actual_dates_chk',$$actual_start_date is null or actual_end_date is null or actual_end_date >= actual_start_date$$),
    ('timesheets','timesheets_status_chk',    $$status in ('Draft','Submitted','Billed','Cancelled')$$),
    ('timesheets','timesheets_rate_chk',      $$exchange_rate > 0$$),
    ('timesheets','timesheets_totals_chk',    $$total_working_hours >= 0 and total_billable_hours >= 0 and total_billable_amount >= 0 and total_costing_amount >= 0$$),
    ('timesheet_entries','entries_hours_chk', $$hours >= 0$$),
    ('timesheet_entries','entries_rates_chk', $$(billing_rate is null or billing_rate >= 0) and (costing_rate is null or costing_rate >= 0)$$),
    ('activity_types','activity_types_rates_chk', $$billing_rate >= 0 and costing_rate >= 0$$),
    ('activity_types','activity_types_billing_type_chk', $$billing_type in ('Hourly','Daily','Fixed Rate')$$),
    ('activity_costs','activity_costs_rates_chk', $$billing_rate >= 0 and costing_rate >= 0$$),
    ('project_template_tasks','template_tasks_chk', $$start_day >= 0 and duration >= 1$$),
    ('project_updates','project_updates_type_chk', $$type in ('Progress','Milestone','Issue','Other')$$),
    ('pm_settings','pm_settings_rates_chk',   $$default_billing_rate >= 0 and default_costing_rate >= 0$$)
  ) as v(tbl, name, expr) loop
    execute format('alter table public.%I drop constraint if exists %I', c.tbl, c.name);
    execute format('alter table public.%I add constraint %I check (%s)', c.tbl, c.name, c.expr);
  end loop;
end $do$;

-- 5. Document codes are immutable once assigned
create or replace function public.forbid_code_change()
returns trigger language plpgsql as $$
begin
  if new.code is distinct from old.code then
    raise exception 'code of % cannot be changed', tg_table_name using errcode = '23514';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets'] loop
    execute format('drop trigger if exists trg_%1$s_code_immutable on public.%1$s', t);
    execute format('create trigger trg_%1$s_code_immutable before update on public.%1$s
                    for each row execute function public.forbid_code_change()', t);
  end loop;
end $$;

-- 6. Task graph rules: no dependency cycles, parents stay inside one project and never loop
create or replace function public.check_dependency_cycle()
returns trigger language plpgsql as $$
begin
  -- adding task -> depends_on is a cycle if depends_on already (transitively) depends on task
  if exists (
    with recursive reach(id) as (
      select new.depends_on_id
      union
      select d.depends_on_id from public.task_dependencies d join reach r on d.task_id = r.id
    )
    select 1 from reach where id = new.task_id
  ) then
    raise exception 'dependency would create a cycle' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_task_dependencies_cycle on public.task_dependencies;
create trigger trg_task_dependencies_cycle before insert or update on public.task_dependencies
  for each row execute function public.check_dependency_cycle();

create or replace function public.check_parent_task()
returns trigger language plpgsql as $$
begin
  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception 'a task cannot be its own parent' using errcode = '23514';
    end if;
    if exists (
      with recursive anc(id) as (
        select new.parent_task_id
        union
        select t.parent_task_id from public.project_tasks t join anc a on t.id = a.id where t.parent_task_id is not null
      )
      select 1 from anc where id = new.id
    ) then
      raise exception 'parent task would create a loop' using errcode = '23514';
    end if;
    -- a task being detached (project set to NULL, e.g. by ON DELETE SET NULL of its project) may keep its parent
    if new.project_id is not null
       and (select project_id from public.project_tasks where id = new.parent_task_id) is distinct from new.project_id then
      raise exception 'parent task must belong to the same project' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_parent_check on public.project_tasks;
create trigger trg_tasks_parent_check before insert or update of parent_task_id, project_id on public.project_tasks
  for each row execute function public.check_parent_task();

-- Moving a task to another project (or losing its project) detaches children left in a different project.
-- AFTER trigger: a BEFORE trigger cannot touch rows that the same statement (FK action) is updating.
create or replace function public.detach_foreign_children()
returns trigger language plpgsql as $$
begin
  update public.project_tasks set parent_task_id = null
   where parent_task_id = new.id and project_id is distinct from new.project_id;
  return null;
end $$;
drop trigger if exists trg_tasks_detach_children on public.project_tasks;
create trigger trg_tasks_detach_children after update of project_id on public.project_tasks
  for each row when (new.project_id is distinct from old.project_id)
  execute function public.detach_foreign_children();
