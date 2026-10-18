-- Project customer / sales order / users, and from_template relation

alter table public.projects add column if not exists customer text;
alter table public.projects add column if not exists sales_order text;

create table if not exists public.project_users (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_email  text not null,
  full_name   text,
  profile_id  uuid references public.profiles(id) on delete set null,
  sort_order  integer not null default 0,
  unique (project_id, user_email)
);
create index if not exists idx_project_users_project on public.project_users(project_id);
create index if not exists idx_project_users_profile on public.project_users(profile_id);

-- link to a profile when the email matches an account
create or replace function public.link_project_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profile_id is null then
    select id, coalesce(new.full_name, full_name) into new.profile_id, new.full_name
      from public.profiles where lower(email) = lower(new.user_email) limit 1;
  end if;
  return new;
end $$;
drop trigger if exists trg_project_users_link on public.project_users;
create trigger trg_project_users_link before insert or update of user_email on public.project_users
  for each row execute function public.link_project_user();

alter table public.project_users enable row level security;
revoke all on public.project_users from anon;
grant select, insert, update, delete on public.project_users to authenticated;
drop policy if exists project_users_all on public.project_users;
create policy project_users_all on public.project_users for all to authenticated using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='project_users') then
    alter publication supabase_realtime add table public.project_users;
  end if;
end $$;

-- projects.from_template is a relation to project_templates.name
update public.projects set from_template = null
 where from_template is not null and from_template not in (select name from public.project_templates);
alter table public.projects drop constraint if exists projects_from_template_fkey;
alter table public.projects add constraint projects_from_template_fkey
  foreign key (from_template) references public.project_templates(name) on update cascade on delete set null;
