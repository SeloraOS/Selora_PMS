-- Phase 3, part 2: work orders, RA bills, payments (money math and approval rules live in the database).

create or replace function public.my_vendor_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.vendors where profile_id = auth.uid()
$$;
revoke all on function public.my_vendor_ids() from public, anon;
grant execute on function public.my_vendor_ids() to authenticated;

-- may the caller approve a document of this value? staff always; other internal users up to the PO limit
create or replace function public.can_approve_amount(p_amount numeric)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or (public.is_internal() and p_amount <= coalesce((select po_approval_limit from public.pm_settings limit 1), 0))
$$;
revoke all on function public.can_approve_amount(numeric) from public, anon;
grant execute on function public.can_approve_amount(numeric) to authenticated;

create table if not exists public.work_orders (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,
  project_id        uuid not null references public.projects(id) on delete cascade,
  vendor_id         uuid not null references public.vendors(id) on delete restrict,
  cost_head_id      uuid not null references public.cost_heads(id) on delete restrict,
  title             text not null check (length(btrim(title)) > 0),
  amount            numeric(14,2) not null check (amount > 0),
  retention_percent numeric(5,2) not null check (retention_percent between 0 and 100), -- filled from the settings when omitted
  status            text not null default 'draft' check (status in ('draft','pending_approval','approved','closed','cancelled')),
  start_date        date,
  end_date          date,
  notes             text,
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists idx_wo_project on public.work_orders(project_id, status);
create index if not exists idx_wo_vendor  on public.work_orders(vendor_id);
create index if not exists idx_wo_head    on public.work_orders(cost_head_id);
create index if not exists idx_wo_creator on public.work_orders(created_by);
create index if not exists idx_wo_approver on public.work_orders(approved_by);

create table if not exists public.ra_bills (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,
  work_order_id     uuid not null references public.work_orders(id) on delete cascade,
  project_id        uuid not null references public.projects(id) on delete cascade,
  vendor_id         uuid not null references public.vendors(id) on delete restrict,
  bill_no           integer not null,
  period_from       date,
  period_to         date,
  gross_amount      numeric(14,2) not null check (gross_amount > 0),
  retention_percent numeric(5,2) not null default 0,
  tds_percent       numeric(5,2) not null default 0,
  gst_percent       numeric(5,2) not null default 0,
  retention_amount  numeric(14,2) not null default 0,
  tds_amount        numeric(14,2) not null default 0,
  gst_amount        numeric(14,2) not null default 0,
  net_amount        numeric(14,2) not null default 0,
  paid_amount       numeric(14,2) not null default 0 check (paid_amount >= 0),
  status            text not null default 'draft' check (status in ('draft','submitted','approved','rejected','paid')),
  due_date          date,
  notes             text,
  submitted_at      timestamptz,
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,
  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (work_order_id, bill_no),
  check (paid_amount <= net_amount),
  check (period_to is null or period_from is null or period_to >= period_from)
);
create index if not exists idx_bills_project on public.ra_bills(project_id, status);
create index if not exists idx_bills_vendor  on public.ra_bills(vendor_id);
create index if not exists idx_bills_creator on public.ra_bills(created_by);
create index if not exists idx_bills_approver on public.ra_bills(approved_by);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  bill_id      uuid not null references public.ra_bills(id) on delete cascade,
  payment_date date not null default current_date,
  mode         text not null default 'Bank transfer' check (mode in ('Bank transfer','Cheque','Cash','UPI')),
  reference    text,
  amount       numeric(14,2) not null check (amount > 0),
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_payments_bill on public.payments(bill_id);
create index if not exists idx_payments_creator on public.payments(created_by);

drop trigger if exists trg_wo_updated on public.work_orders;
create trigger trg_wo_updated before update on public.work_orders for each row execute function public.set_updated_at();
drop trigger if exists trg_wo_code on public.work_orders;
create trigger trg_wo_code before insert on public.work_orders for each row execute function public.assign_doc_code('WO');
drop trigger if exists trg_wo_code_immutable on public.work_orders;
create trigger trg_wo_code_immutable before update on public.work_orders for each row execute function public.forbid_code_change();
drop trigger if exists trg_bills_updated on public.ra_bills;
create trigger trg_bills_updated before update on public.ra_bills for each row execute function public.set_updated_at();
drop trigger if exists trg_bills_code_immutable on public.ra_bills;
create trigger trg_bills_code_immutable before update on public.ra_bills for each row execute function public.forbid_code_change();

-- ── work order rules ────────────────────────────────────────────────────────
create or replace function public.wo_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare billed numeric;
begin
  if not exists (select 1 from public.vendors where id = new.vendor_id and (is_active or (tg_op = 'UPDATE' and old.vendor_id = new.vendor_id))) then
    raise exception 'The vendor is inactive' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.approved_by := null; new.approved_at := null;
    if new.status not in ('draft','pending_approval') then
      if not public.can_approve_amount(new.amount) then raise exception 'A work order of this value needs approval before it is issued' using errcode = '42501'; end if;
      new.approved_by := auth.uid(); new.approved_at := now();
    end if;
    if new.retention_percent is null then new.retention_percent := coalesce((select retention_percent from public.pm_settings limit 1), 5); end if;
  else
    if new.status in ('approved','closed') and old.status in ('draft','pending_approval') then
      if not public.can_approve_amount(new.amount) then raise exception 'This work order needs approval from an admin or manager (above the approval limit)' using errcode = '42501'; end if;
      new.approved_by := auth.uid(); new.approved_at := now();
    elsif old.status in ('draft','pending_approval') then
      new.approved_by := null; new.approved_at := null;
    else
      new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    end if;
    if old.status in ('approved','closed') and new.status in ('draft','pending_approval') then
      raise exception 'An approved work order cannot go back to draft' using errcode = '23514';
    end if;
    if new.amount is distinct from old.amount and old.status in ('approved','closed') and not public.is_staff() then
      raise exception 'Only admins and managers can change the value of an approved work order' using errcode = '42501';
    end if;
    select coalesce(sum(gross_amount), 0) into billed from public.ra_bills where work_order_id = new.id and status <> 'rejected';
    if new.amount < billed then raise exception 'The value cannot be lower than the amount already billed (%)', billed using errcode = '23514'; end if;
    if new.status = 'cancelled' and exists (select 1 from public.ra_bills where work_order_id = new.id and status in ('approved','paid')) then
      raise exception 'A work order with approved bills cannot be cancelled' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_wo_rules on public.work_orders;
create trigger trg_wo_rules before insert or update on public.work_orders for each row execute function public.wo_rules();

-- ── RA bill rules and money math ────────────────────────────────────────────
create or replace function public.ra_amounts()
returns trigger language plpgsql as $$
begin
  new.retention_amount := round(new.gross_amount * new.retention_percent / 100, 2);
  new.tds_amount       := round(new.gross_amount * new.tds_percent / 100, 2);
  new.gst_amount       := round(new.gross_amount * new.gst_percent / 100, 2);
  new.net_amount       := new.gross_amount + new.gst_amount - new.retention_amount - new.tds_amount;
  return new;
end $$;

create or replace function public.bill_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare wo public.work_orders; s public.pm_settings; role public.app_role := public.current_app_role(); others numeric;
begin
  if current_setting('selora.sync', true) = '1' then return new; end if; -- payment roll-up
  select * into wo from public.work_orders where id = new.work_order_id;
  select * into s from public.pm_settings limit 1;
  if tg_op = 'INSERT' then
    if wo.status <> 'approved' then raise exception 'Bills can only be raised against an approved work order' using errcode = '23514'; end if;
    new.project_id := wo.project_id; new.vendor_id := wo.vendor_id;
    new.bill_no := coalesce((select max(bill_no) from public.ra_bills where work_order_id = wo.id), 0) + 1;
    new.retention_percent := wo.retention_percent; new.tds_percent := s.tds_rate; new.gst_percent := s.gst_rate;
    new.paid_amount := 0; new.approved_by := null; new.approved_at := null; new.submitted_at := null;
    new.code := public.next_doc_code(s.ra_bill_prefix, 4);
    if role = 'contractor' and new.status not in ('draft','submitted') then new.status := 'draft'; end if;
    if new.status not in ('draft','submitted') then new.status := 'draft'; end if;
    if new.status = 'submitted' then new.submitted_at := now(); end if;
    new.due_date := coalesce(new.due_date, coalesce(new.period_to, current_date) + s.payment_terms_days);
  else
    -- identity of the bill is fixed
    new.work_order_id := old.work_order_id; new.project_id := old.project_id; new.vendor_id := old.vendor_id; new.bill_no := old.bill_no;
    new.paid_amount := old.paid_amount;
    if old.status in ('approved','paid','rejected') then
      if new.gross_amount is distinct from old.gross_amount or new.period_from is distinct from old.period_from or new.period_to is distinct from old.period_to then
        raise exception 'An approved or closed bill can no longer be changed' using errcode = '23514';
      end if;
    end if;
    new.retention_percent := old.retention_percent; new.tds_percent := old.tds_percent; new.gst_percent := old.gst_percent;
    if role = 'contractor' then
      if old.status <> 'draft' then raise exception 'Submitted bills are read-only for contractors' using errcode = '42501'; end if;
      if new.status not in ('draft','submitted') then raise exception 'Contractors can only submit their bills' using errcode = '42501'; end if;
    end if;
    if new.status is distinct from old.status then
      if new.status = 'submitted' and old.status = 'draft' then new.submitted_at := now();
      elsif new.status in ('approved','rejected') and old.status = 'submitted' then
        if not public.is_internal() then raise exception 'Not allowed' using errcode = '42501'; end if;
        if new.status = 'approved' then
          if not public.can_approve_amount(new.gross_amount) then raise exception 'This bill needs approval from an admin or manager (above the approval limit)' using errcode = '42501'; end if;
          new.approved_by := auth.uid(); new.approved_at := now();
        end if;
      elsif new.status = 'draft' and old.status in ('submitted','rejected') and public.is_internal() then null;
      else raise exception 'Invalid bill status change % -> %', old.status, new.status using errcode = '23514'; end if;
    end if;
  end if;
  select coalesce(sum(gross_amount), 0) into others from public.ra_bills where work_order_id = new.work_order_id and status <> 'rejected' and id <> new.id;
  if new.status <> 'rejected' and others + new.gross_amount > wo.amount then
    raise exception 'Billed value (%) would exceed the work order value (%)', others + new.gross_amount, wo.amount using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_bills_01_rules on public.ra_bills;
create trigger trg_bills_01_rules before insert or update on public.ra_bills for each row execute function public.bill_rules();
drop trigger if exists trg_bills_02_amounts on public.ra_bills;
create trigger trg_bills_02_amounts before insert or update on public.ra_bills for each row execute function public.ra_amounts();

-- ── payments ────────────────────────────────────────────────────────────────
create or replace function public.payment_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare b public.ra_bills; paid numeric;
begin
  select * into b from public.ra_bills where id = new.bill_id for update;
  if b.status not in ('approved','paid') then raise exception 'Payments can only be recorded against an approved bill' using errcode = '23514'; end if;
  select coalesce(sum(amount), 0) into paid from public.payments where bill_id = new.bill_id and id is distinct from new.id;
  if paid + new.amount > b.net_amount then raise exception 'Payments (%) would exceed the bill net amount (%)', paid + new.amount, b.net_amount using errcode = '23514'; end if;
  return new;
end $$;
drop trigger if exists trg_payments_check on public.payments;
create trigger trg_payments_check before insert or update of amount, bill_id on public.payments for each row execute function public.payment_check();

create or replace function public.payment_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(new.bill_id, old.bill_id); total numeric;
begin
  select coalesce(sum(amount), 0) into total from public.payments where bill_id = bid;
  perform set_config('selora.sync', '1', true);
  update public.ra_bills set paid_amount = total, status = case when total >= net_amount and net_amount > 0 then 'paid' else 'approved' end
   where id = bid and status in ('approved','paid');
  perform set_config('selora.sync', '0', true);
  return null;
end $$;
drop trigger if exists trg_payments_sync on public.payments;
create trigger trg_payments_sync after insert or update or delete on public.payments for each row execute function public.payment_sync();
