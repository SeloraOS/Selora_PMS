-- Profiles + roles, linked to Supabase Auth

do $$ begin
  create type public.app_role as enum ('admin', 'manager', 'member');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile for every new auth user. The very first user becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'member'::public.app_role
         else 'admin'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist
insert into public.profiles (id, email, full_name, role)
select u.id, u.email, split_part(u.email, '@', 1),
       case when row_number() over (order by u.created_at) = 1 then 'admin'::public.app_role
            else 'member'::public.app_role end
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
  and not exists (select 1 from public.profiles);

create or replace function public.current_role_is(variadic roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = any(roles));
$$;
