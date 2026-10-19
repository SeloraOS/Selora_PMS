-- Phase 1, part 2: access helpers, membership roles, record visibility.
-- Roles: admin/manager = staff (full access); member = internal employee (sees all projects unless
-- pm_settings.members_see_all is off); client/contractor = external (only projects they belong to).

-- membership roles and who invited whom
alter table public.project_users add column if not exists project_role text not null default 'viewer'
  check (project_role in ('owner','staff','contractor','client','viewer'));
alter table public.project_users add column if not exists invited_by uuid references auth.users(id) on delete set null;
create index if not exists idx_project_users_invited_by on public.project_users(invited_by);

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.is_staff()    returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.current_app_role() in ('admin','manager'), false) $$;
create or replace function public.is_external() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.current_app_role() in ('client','contractor'), false) $$;
create or replace function public.is_internal() returns boolean language sql stable security definer set search_path = public as $$ select coalesce(public.current_app_role() in ('admin','manager','member'), false) $$;
create or replace function public.members_see_all() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select members_see_all from public.pm_settings limit 1), true)
$$;

create or replace function public.my_project_role(p uuid)
returns text language sql stable security definer set search_path = public as $$
  select project_role from public.project_users where project_id = p and profile_id = auth.uid() limit 1
$$;

create or replace function public.can_access_project(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.is_staff() then true
    when public.current_app_role() = 'member' and public.members_see_all() then true
    else exists (select 1 from public.project_users where project_id = p and profile_id = auth.uid())
  end
$$;

-- membership rows added before the account existed get linked when the profile appears
create or replace function public.relink_project_users()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.project_users set profile_id = new.id
   where profile_id is null and lower(user_email) = lower(new.email);
  return new;
end $$;
drop trigger if exists trg_profiles_relink on public.profiles;
create trigger trg_profiles_relink after insert or update of email on public.profiles
  for each row execute function public.relink_project_users();

-- tasks can be assigned to a person (contractors act on their own tasks)
alter table public.project_tasks add column if not exists assignee_id uuid references public.profiles(id) on delete set null;
create index if not exists idx_tasks_assignee on public.project_tasks(assignee_id);

-- what clients may see: only records explicitly shared with them
alter table public.project_updates add column if not exists visibility text not null default 'internal' check (visibility in ('internal','shared'));

-- contractors may only change progress fields of the tasks assigned to them
create or replace function public.enforce_contractor_task_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare keys text[] := array['status','actual_start_date','actual_end_date','updated_at'];
begin
  if public.current_app_role() = 'contractor'
     and (to_jsonb(new) - keys) is distinct from (to_jsonb(old) - keys) then
    raise exception 'Contractors can only update the status and actual dates of their tasks' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_tasks_contractor_guard on public.project_tasks;
create trigger trg_tasks_contractor_guard before update on public.project_tasks
  for each row execute function public.enforce_contractor_task_update();

-- first-login password change for invited accounts (no e-mail delivery needed)
alter table public.profiles add column if not exists must_change_password boolean not null default false;
create or replace function public.clear_must_change_password()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid()
$$;
revoke all on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;

-- helper grants (policies call these as the signed-in user)
do $$
declare f text;
begin
  foreach f in array array['current_app_role()','is_staff()','is_external()','is_internal()','members_see_all()','my_project_role(uuid)','can_access_project(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
