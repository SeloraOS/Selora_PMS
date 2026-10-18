-- Setup / lookup tables

create table if not exists public.project_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity_types (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  costing_rate   numeric(14,2) not null default 0,
  billing_rate   numeric(14,2) not null default 0,
  disabled       boolean not null default false,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.activity_costs (
  id               uuid primary key default gen_random_uuid(),
  employee         text,
  activity_type_id uuid references public.activity_types(id) on delete cascade,
  billing_rate     numeric(14,2) not null default 0,
  costing_rate     numeric(14,2) not null default 0,
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_activity_costs_type on public.activity_costs(activity_type_id);

create table if not exists public.project_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  project_type_id uuid references public.project_types(id) on delete set null,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_project_templates_type on public.project_templates(project_type_id);

create table if not exists public.project_template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.project_templates(id) on delete cascade,
  subject     text not null,
  description text,
  start_day   integer not null default 0,
  duration    integer not null default 1,
  sort_order  integer not null default 0
);
create index if not exists idx_template_tasks_template on public.project_template_tasks(template_id);

do $$
declare t text;
begin
  foreach t in array array['project_types','activity_types','activity_costs','project_templates'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
