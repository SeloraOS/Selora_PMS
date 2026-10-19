-- Phase 3 (money), part 1: settings, cost heads, vendors, budgets with revision history.

alter table public.pm_settings
  add column if not exists retention_percent             numeric(5,2) not null default 5    check (retention_percent between 0 and 100),
  add column if not exists gst_rate                      numeric(5,2) not null default 18   check (gst_rate between 0 and 100),
  add column if not exists tds_rate                      numeric(5,2) not null default 1    check (tds_rate between 0 and 100),
  add column if not exists po_approval_limit             numeric(14,2) not null default 500000 check (po_approval_limit >= 0),
  add column if not exists budget_overrun_alert_percent  integer not null default 90        check (budget_overrun_alert_percent between 1 and 200),
  add column if not exists payment_terms_days            integer not null default 30        check (payment_terms_days between 0 and 365),
  add column if not exists fiscal_year_start_month       integer not null default 4         check (fiscal_year_start_month between 1 and 12),
  add column if not exists ra_bill_prefix                text    not null default 'RA'      check (ra_bill_prefix ~ '^[A-Z]{1,6}$');

create table if not exists public.cost_heads (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
insert into public.cost_heads (name, sort_order) values
  ('Land',1),('Approvals & statutory',2),('Civil & structure',3),('MEP',4),('Finishing',5),('Marketing & sales',6),('Contingency',7)
  on conflict (name) do nothing;

create table if not exists public.vendors (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  name         text not null unique check (length(btrim(name)) > 0),
  category     text,
  gstin        text check (gstin is null or gstin ~ '^[0-9A-Z]{15}$'),
  pan          text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  contact_name text,
  phone        text,
  email        text,
  bank_name    text,
  bank_account text,
  ifsc         text,
  profile_id   uuid references public.profiles(id) on delete set null, -- portal login of this vendor (a contractor user)
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_vendors_profile on public.vendors(profile_id);
drop trigger if exists trg_vendors_updated on public.vendors;
create trigger trg_vendors_updated before update on public.vendors for each row execute function public.set_updated_at();
drop trigger if exists trg_vendors_code on public.vendors;
create trigger trg_vendors_code before insert on public.vendors for each row execute function public.assign_doc_code('VND');
drop trigger if exists trg_vendors_code_immutable on public.vendors;
create trigger trg_vendors_code_immutable before update on public.vendors for each row execute function public.forbid_code_change();

create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  cost_head_id uuid not null references public.cost_heads(id) on delete restrict,
  amount       numeric(14,2) not null default 0 check (amount >= 0),
  revision     integer not null default 1,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (project_id, cost_head_id)
);
create index if not exists idx_budgets_head on public.budgets(cost_head_id);

create table if not exists public.budget_revisions (
  id          uuid primary key default gen_random_uuid(),
  budget_id   uuid not null references public.budgets(id) on delete cascade,
  revision    integer not null,
  old_amount  numeric(14,2),
  new_amount  numeric(14,2) not null,
  reason      text,
  changed_by  uuid default auth.uid() references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);
create index if not exists idx_budget_rev_budget on public.budget_revisions(budget_id, revision);
create index if not exists idx_budget_rev_user on public.budget_revisions(changed_by);

create or replace function public.budget_track()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.budget_revisions (budget_id, revision, old_amount, new_amount, reason) values (new.id, new.revision, null, new.amount, new.notes);
  elsif new.amount is distinct from old.amount then
    new.revision := old.revision + 1;
    new.updated_at := now();
    insert into public.budget_revisions (budget_id, revision, old_amount, new_amount, reason) values (new.id, new.revision, old.amount, new.amount, new.notes);
  end if;
  return new;
end $$;
drop trigger if exists trg_budget_track_ins on public.budgets;
create trigger trg_budget_track_ins after insert on public.budgets for each row execute function public.budget_track();
drop trigger if exists trg_budget_track_upd on public.budgets;
create trigger trg_budget_track_upd before update on public.budgets for each row execute function public.budget_track();
