-- Phase 2, part 2: daily progress reports (DPR).

create table if not exists public.daily_reports (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  project_id   uuid not null references public.projects(id) on delete cascade,
  report_date  date not null default current_date,
  weather      text,
  blockers     text,
  summary      text,
  status       text not null default 'draft' check (status in ('draft','submitted')),
  visibility   text not null default 'internal' check (visibility in ('internal','shared')),
  submitted_at timestamptz,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, report_date)
);
create index if not exists idx_dpr_project on public.daily_reports(project_id, report_date desc);
create index if not exists idx_dpr_created_by on public.daily_reports(created_by);

create table if not exists public.daily_report_work (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.daily_reports(id) on delete cascade,
  task_id      uuid references public.project_tasks(id) on delete set null,
  progress_pct numeric(5,2) not null default 0 check (progress_pct between 0 and 100),
  note         text,
  sort_order   integer not null default 0
);
create index if not exists idx_dpr_work_report on public.daily_report_work(report_id);
create index if not exists idx_dpr_work_task   on public.daily_report_work(task_id);

create table if not exists public.daily_report_manpower (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.daily_reports(id) on delete cascade,
  trade      text not null references public.trades(name) on update cascade,
  head_count integer not null default 0 check (head_count >= 0),
  sort_order integer not null default 0,
  unique (report_id, trade)
);
create index if not exists idx_dpr_manpower_report on public.daily_report_manpower(report_id);
create index if not exists idx_dpr_manpower_trade  on public.daily_report_manpower(trade);

drop trigger if exists trg_daily_reports_updated on public.daily_reports;
create trigger trg_daily_reports_updated before update on public.daily_reports for each row execute function public.set_updated_at();
drop trigger if exists trg_daily_reports_code on public.daily_reports;
create trigger trg_daily_reports_code before insert on public.daily_reports for each row execute function public.assign_doc_code('DPR');
drop trigger if exists trg_daily_reports_code_immutable on public.daily_reports;
create trigger trg_daily_reports_code_immutable before update on public.daily_reports for each row execute function public.forbid_code_change();

-- submitted reports are final for contractors; submitting pushes progress to the tasks
create or replace function public.dpr_on_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.submitted_at := coalesce(new.submitted_at, now());
  return new;
end $$;
drop trigger if exists trg_dpr_submit_stamp on public.daily_reports;
create trigger trg_dpr_submit_stamp before update of status on public.daily_reports
  for each row when (old.status = 'draft' and new.status = 'submitted') execute function public.dpr_on_submit();

create or replace function public.dpr_apply_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.project_tasks t
     set percent_complete = greatest(t.percent_complete, w.progress_pct),
         status = case when w.progress_pct >= 100 then 'Completed' when t.status = 'Open' and w.progress_pct > 0 then 'Working' else t.status end,
         actual_start_date = coalesce(t.actual_start_date, case when w.progress_pct > 0 then new.report_date end),
         actual_end_date   = case when w.progress_pct >= 100 then coalesce(t.actual_end_date, new.report_date) else t.actual_end_date end
    from public.daily_report_work w
   where w.report_id = new.id and w.task_id = t.id and t.project_id = new.project_id and w.progress_pct > 0;
  return null;
end $$;
drop trigger if exists trg_dpr_apply_progress on public.daily_reports;
create trigger trg_dpr_apply_progress after update of status on public.daily_reports
  for each row when (old.status = 'draft' and new.status = 'submitted') execute function public.dpr_apply_progress();

-- a work line must reference a task of the same project
create or replace function public.check_dpr_work()
returns trigger language plpgsql as $$
begin
  if new.task_id is not null and not exists (
    select 1 from public.project_tasks t join public.daily_reports r on r.project_id = t.project_id
     where t.id = new.task_id and r.id = new.report_id) then
    raise exception 'The task does not belong to the report''s project' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_dpr_work_check on public.daily_report_work;
create trigger trg_dpr_work_check before insert or update of task_id on public.daily_report_work for each row execute function public.check_dpr_work();
