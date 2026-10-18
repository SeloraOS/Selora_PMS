-- Holiday lists

create table if not exists public.holiday_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_holiday_lists_created_by on public.holiday_lists(created_by);
drop trigger if exists trg_holiday_lists_updated on public.holiday_lists;
create trigger trg_holiday_lists_updated before update on public.holiday_lists
  for each row execute function public.set_updated_at();

create table if not exists public.holidays (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.holiday_lists(id) on delete cascade,
  holiday_date date not null,
  description  text,
  unique (list_id, holiday_date)
);
create index if not exists idx_holidays_list on public.holidays(list_id);

insert into public.holiday_lists (name) values ('Standard Corporate'), ('Factory Shift') on conflict (name) do nothing;

-- text columns become relations
update public.projects set holiday_list = null where holiday_list is not null and holiday_list not in (select name from public.holiday_lists);
update public.pm_settings set holiday_list = null where holiday_list is not null and holiday_list not in (select name from public.holiday_lists);
alter table public.projects drop constraint if exists projects_holiday_list_fkey;
alter table public.projects add constraint projects_holiday_list_fkey
  foreign key (holiday_list) references public.holiday_lists(name) on update cascade on delete set null;
alter table public.pm_settings drop constraint if exists pm_settings_holiday_list_fkey;
alter table public.pm_settings add constraint pm_settings_holiday_list_fkey
  foreign key (holiday_list) references public.holiday_lists(name) on update cascade on delete set null;

do $$
declare t text;
begin
  foreach t in array array['holiday_lists','holidays'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated
                    using (public.current_role_is(''admin'',''manager'')) with check (public.current_role_is(''admin'',''manager''))', t);
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
