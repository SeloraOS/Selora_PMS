-- Phase 2 (site reality), part 1: settings, lookups, task progress + baseline.

alter table public.pm_settings
  add column if not exists dpr_required          boolean not null default false,
  add column if not exists dpr_cutoff_time       time    not null default '18:00',
  add column if not exists approval_warning_days integer not null default 30 check (approval_warning_days between 1 and 365),
  add column if not exists snag_default_due_days integer not null default 7  check (snag_default_due_days between 1 and 90),
  add column if not exists working_days          text    not null default 'Mon,Tue,Wed,Thu,Fri,Sat'
    check (working_days ~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,(Mon|Tue|Wed|Thu|Fri|Sat|Sun))*$');

-- lookups
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.snag_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
insert into public.trades (name) values ('Mason'),('Carpenter'),('Electrician'),('Plumber'),('Painter'),('Steel fixer'),('Shuttering'),('Helper'),('Supervisor'),('Operator')
  on conflict (name) do nothing;
insert into public.snag_categories (name) values ('Civil'),('Electrical'),('Plumbing'),('Finishing'),('Waterproofing'),('Safety'),('Other')
  on conflict (name) do nothing;

-- task progress and baseline
alter table public.project_tasks
  add column if not exists percent_complete numeric(5,2) not null default 0 check (percent_complete between 0 and 100),
  add column if not exists baseline_start_date date,
  add column if not exists baseline_end_date   date,
  add column if not exists baseline_set_at     timestamptz;

create or replace function public.task_completed_is_100()
returns trigger language plpgsql as $$
begin
  if new.status = 'Completed' then new.percent_complete := 100; end if;
  return new;
end $$;
drop trigger if exists trg_tasks_completed_100 on public.project_tasks;
create trigger trg_tasks_completed_100 before insert or update of status on public.project_tasks
  for each row execute function public.task_completed_is_100();

-- contractors may also report progress on their own tasks
create or replace function public.enforce_contractor_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare keys text[] := array['status','actual_start_date','actual_end_date','percent_complete','updated_at'];
begin
  if public.current_app_role() = 'contractor'
     and (to_jsonb(new) - keys) is distinct from (to_jsonb(old) - keys) then
    raise exception 'Contractors can only update the status, progress and actual dates of their tasks' using errcode = '42501';
  end if;
  return new;
end $$;

-- freeze the current plan as the baseline (staff only)
create or replace function public.set_project_baseline(p_project uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_staff() then raise exception 'Only admins and managers can set a baseline' using errcode = '42501'; end if;
  update public.project_tasks
     set baseline_start_date = expected_start_date, baseline_end_date = expected_end_date, baseline_set_at = now()
   where project_id = p_project and (expected_start_date is not null or expected_end_date is not null);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.set_project_baseline(uuid) from public, anon;
grant execute on function public.set_project_baseline(uuid) to authenticated;
