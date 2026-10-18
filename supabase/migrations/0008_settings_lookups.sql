-- Settings, companies, project updates, billing type, project type FK

-- Single-row settings table (id is always true)
create table if not exists public.pm_settings (
  id                    boolean primary key default true check (id),
  company               text not null default 'Selora Realty',
  currency              text not null default 'INR',
  holiday_list          text,
  default_billing_rate  numeric(14,2) not null default 1000,
  default_costing_rate  numeric(14,2) not null default 600,
  limit_timesheet       boolean not null default false,
  auto_close_tasks      boolean not null default true,
  task_alerts           boolean not null default true,
  updated_at            timestamptz not null default now()
);
insert into public.pm_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_pm_settings_updated on public.pm_settings;
create trigger trg_pm_settings_updated before update on public.pm_settings
  for each row execute function public.set_updated_at();

create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
insert into public.companies (name) values ('Selora Realty') on conflict (name) do nothing;

create table if not exists public.project_updates (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  type         text not null default 'Progress',
  description  text,
  update_date  date not null default current_date,
  sent_to      text,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_project_updates_project on public.project_updates(project_id);
drop trigger if exists trg_project_updates_updated on public.project_updates;
create trigger trg_project_updates_updated before update on public.project_updates
  for each row execute function public.set_updated_at();

alter table public.activity_types add column if not exists billing_type text not null default 'Hourly';

-- projects.project_type (text) -> project_type_id (FK)
alter table public.projects add column if not exists project_type_id uuid references public.project_types(id) on delete set null;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='project_type') then
    insert into public.project_types (name)
      select distinct project_type from public.projects where project_type is not null and project_type <> ''
      on conflict (name) do nothing;
    update public.projects p set project_type_id = t.id
      from public.project_types t where t.name = p.project_type and p.project_type_id is null;
    alter table public.projects drop column project_type;
  end if;
end $$;
create index if not exists idx_projects_type on public.projects(project_type_id);

-- RLS / grants for the new tables
do $$
declare t text;
begin
  foreach t in array array['pm_settings','companies','project_updates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (true)', t);
  end loop;
end $$;

-- settings + companies: admin/manager write
drop policy if exists pm_settings_write on public.pm_settings;
create policy pm_settings_write on public.pm_settings for all to authenticated
  using (public.current_role_is('admin','manager')) with check (public.current_role_is('admin','manager'));
drop policy if exists companies_write on public.companies;
create policy companies_write on public.companies for all to authenticated
  using (public.current_role_is('admin','manager')) with check (public.current_role_is('admin','manager'));

-- project updates: like core tables
drop policy if exists project_updates_insert on public.project_updates;
create policy project_updates_insert on public.project_updates for insert to authenticated with check (true);
drop policy if exists project_updates_update on public.project_updates;
create policy project_updates_update on public.project_updates for update to authenticated using (true) with check (true);
drop policy if exists project_updates_delete on public.project_updates;
create policy project_updates_delete on public.project_updates for delete to authenticated
  using (created_by = auth.uid() or public.current_role_is('admin','manager'));

-- Realtime for every table the setup context watches
do $$
declare t text;
begin
  foreach t in array array['project_types','activity_types','activity_costs','project_templates','project_template_tasks',
                           'companies','project_updates','pm_settings','profiles'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
