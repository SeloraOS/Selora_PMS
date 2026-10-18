-- Security fix: never auto-promote on sign-up. Sign-ups are open, so "first user without an admin
-- becomes admin" (0007) would let anyone who registers while no admin exists take over the app.
-- New accounts are always members; promote the first admin explicitly:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'member'::public.app_role
  )
  on conflict (id) do nothing;
  return new;
end $$;
