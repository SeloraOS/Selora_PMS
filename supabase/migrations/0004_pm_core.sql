-- Core PM tables: projects, project_tasks, timesheets, timesheet_entries

create table if not exists public.projects (
  id                           uuid primary key default gen_random_uuid(),
  code                         text unique,
  series                       text default 'PROJ-.####',
  project_name                 text not null unique,
  from_template                text,
  company                      text default 'Selora',
  status                       text not null default 'Open',
  project_type                 text,
  percent_complete_method      text default 'Task Completion',
  priority                     text not null default 'Medium',
  department                   text,
  is_active                    boolean not null default true,
  estimated_cost               numeric(14,2),
  default_cost_center          text,
  collect_progress             boolean not null default false,
  holiday_list                 text,
  frequency_to_collect_progress text default 'Hourly',
  from_time                    time,
  to_time                      time,
  subject                      text,
  message                      text,
  notes                        text,
  description                  text,
  expected_start_date          date,
  expected_end_date            date,
  actual_start_date            date,
  actual_end_date              date,
  created_by                   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);
create index if not exists idx_projects_status on public.projects(status);

create table if not exists public.project_tasks (
  id                   uuid primary key default gen_random_uuid(),
  code                 text unique,
  subject              text not null,
  project_id           uuid references public.projects(id) on delete set null,
  is_template          boolean not null default false,
  issue                text,
  type                 text,
  color                text,
  is_group             boolean not null default false,
  status               text not null default 'Open',
  priority             text not null default 'Low',
  weight               numeric(10,2),
  parent_task          text,
  description          text,
  dependencies         jsonb not null default '[]'::jsonb,
  company              text default 'Selora',
  department           text,
  expected_start_date  date,
  expected_end_date    date,
  actual_start_date    date,
  actual_end_date      date,
  created_by           uuid default auth.uid() references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_tasks_project on public.project_tasks(project_id);
create index if not exists idx_tasks_status  on public.project_tasks(status);

create table if not exists public.timesheets (
  id                    uuid primary key default gen_random_uuid(),
  code                  text unique,
  series                text default 'TS-.YYYY.-',
  status                text not null default 'Draft',
  company               text default 'Selora',
  project_id            uuid references public.projects(id) on delete set null,
  customer              text,
  currency              text default 'INR',
  exchange_rate         numeric(14,6) not null default 1,
  employee              text,
  total_working_hours   numeric(12,2) not null default 0,
  total_billable_hours  numeric(12,2) not null default 0,
  total_billable_amount numeric(14,2) not null default 0,
  total_costing_amount  numeric(14,2) not null default 0,
  note                  text,
  created_by            uuid default auth.uid() references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_timesheets_project on public.timesheets(project_id);
create index if not exists idx_timesheets_status  on public.timesheets(status);

create table if not exists public.timesheet_entries (
  id            uuid primary key default gen_random_uuid(),
  timesheet_id  uuid not null references public.timesheets(id) on delete cascade,
  activity_type text,
  from_time     timestamp,
  hours         numeric(10,2) not null default 0,
  project_id    uuid references public.projects(id) on delete set null,
  is_billable   boolean not null default true,
  sort_order    integer not null default 0
);
create index if not exists idx_entries_timesheet on public.timesheet_entries(timesheet_id);
create index if not exists idx_entries_project   on public.timesheet_entries(project_id);

-- Triggers: updated_at + document codes
do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

drop trigger if exists trg_projects_code on public.projects;
create trigger trg_projects_code before insert on public.projects
  for each row execute function public.assign_doc_code('PROJ');
drop trigger if exists trg_tasks_code on public.project_tasks;
create trigger trg_tasks_code before insert on public.project_tasks
  for each row execute function public.assign_doc_code('TASK');
drop trigger if exists trg_timesheets_code on public.timesheets;
create trigger trg_timesheets_code before insert on public.timesheets
  for each row execute function public.assign_doc_code('TS');

-- Keep timesheet totals in sync with entries (mock rates match the UI: 1500 billing / 800 costing per hour)
create or replace function public.recalc_timesheet_totals()
returns trigger language plpgsql as $$
declare
  ts uuid := coalesce(new.timesheet_id, old.timesheet_id);
  total numeric; billable numeric;
begin
  select coalesce(sum(hours),0), coalesce(sum(hours) filter (where is_billable),0)
    into total, billable
    from public.timesheet_entries where timesheet_id = ts;
  update public.timesheets
     set total_working_hours   = total,
         total_billable_hours  = billable,
         total_billable_amount = billable * 1500,
         total_costing_amount  = total * 800
   where id = ts;
  return null;
end $$;

drop trigger if exists trg_entries_totals on public.timesheet_entries;
create trigger trg_entries_totals after insert or update or delete on public.timesheet_entries
  for each row execute function public.recalc_timesheet_totals();
