-- Timesheet rows can reference a task; pm_settings.limit_timesheet makes that mandatory and checks the task is active.

alter table public.timesheet_entries add column if not exists task_id uuid references public.project_tasks(id) on delete set null;
create index if not exists idx_entries_task on public.timesheet_entries(task_id);

create or replace function public.check_entry_task()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  limited boolean;
  t record;
begin
  select limit_timesheet into limited from public.pm_settings limit 1;

  if new.task_id is null then
    if coalesce(limited, false) then
      raise exception 'Timesheet rows need a task (Limit Timesheet Creation is on)' using errcode = '23514';
    end if;
    return new;
  end if;

  select status, project_id, subject into t from public.project_tasks where id = new.task_id;
  if new.project_id is not null and t.project_id is distinct from new.project_id then
    raise exception 'Task "%" does not belong to the selected project', t.subject using errcode = '23514';
  end if;
  if coalesce(limited, false) and t.status not in ('Open','Working','Pending','Overdue') then
    raise exception 'Task "%" is % and cannot receive time (Limit Timesheet Creation is on)', t.subject, t.status using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_entries_task_check on public.timesheet_entries;
create trigger trg_entries_task_check before insert or update of task_id, project_id on public.timesheet_entries
  for each row execute function public.check_entry_task();
