-- First-admin rule: the first user *without an existing admin* becomes admin
-- (so a non-admin demo account does not block the real first admin).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'admin') then 'member'::public.app_role
         else 'admin'::public.app_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;
