-- Indexes for the foreign keys added in 0011-0013 (speeds up ON UPDATE CASCADE / ON DELETE checks)
create index if not exists idx_projects_company        on public.projects(company);
create index if not exists idx_projects_from_template  on public.projects(from_template);
create index if not exists idx_projects_holiday_list   on public.projects(holiday_list);
create index if not exists idx_tasks_company           on public.project_tasks(company);
create index if not exists idx_timesheets_company      on public.timesheets(company);
create index if not exists idx_entries_activity_type   on public.timesheet_entries(activity_type);
create index if not exists idx_pm_settings_company     on public.pm_settings(company);
create index if not exists idx_pm_settings_holiday     on public.pm_settings(holiday_list);
