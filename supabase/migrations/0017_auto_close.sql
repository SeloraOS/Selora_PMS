-- Auto Close Tasks (pm_settings.auto_close_tasks): finishing the last open child completes its parent,
-- finishing the last open task completes the project. Never re-opens anything.

create or replace function public.auto_close_cascade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  enabled boolean;
  p_id uuid;
  proj uuid;
begin
  select auto_close_tasks into enabled from public.pm_settings limit 1;
  if not coalesce(enabled, false) then return null; end if;

  p_id := coalesce(new.parent_task_id, old.parent_task_id);
  proj := coalesce(new.project_id, old.project_id);

  -- parent task: every child closed, at least one completed
  if p_id is not null then
    update public.project_tasks p
       set status = 'Completed', actual_end_date = coalesce(p.actual_end_date, current_date)
     where p.id = p_id
       and p.status not in ('Completed','Cancelled')
       and exists (select 1 from public.project_tasks c where c.parent_task_id = p.id)
       and not exists (select 1 from public.project_tasks c where c.parent_task_id = p.id and c.status not in ('Completed','Cancelled'))
       and exists (select 1 from public.project_tasks c where c.parent_task_id = p.id and c.status = 'Completed');
  end if;

  -- project: every non-template task closed, at least one completed
  if proj is not null then
    update public.projects pr
       set status = 'Completed', actual_end_date = coalesce(pr.actual_end_date, current_date)
     where pr.id = proj
       and pr.status = 'Open'
       and not exists (select 1 from public.project_tasks t where t.project_id = pr.id and not t.is_template and t.status not in ('Completed','Cancelled'))
       and exists (select 1 from public.project_tasks t where t.project_id = pr.id and not t.is_template and t.status = 'Completed');
  end if;
  return null;
end $$;

drop trigger if exists trg_tasks_auto_close on public.project_tasks;
create trigger trg_tasks_auto_close after insert or update of status or delete on public.project_tasks
  for each row execute function public.auto_close_cascade();
