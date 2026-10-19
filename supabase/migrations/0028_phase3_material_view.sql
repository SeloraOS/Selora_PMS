-- Phase 3, part 3: material requests and the finance roll-up view.

create table if not exists public.material_requests (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  project_id   uuid not null references public.projects(id) on delete cascade,
  item         text not null check (length(btrim(item)) > 0),
  quantity     numeric(12,2) not null check (quantity > 0),
  unit         text not null default 'nos',
  needed_by    date,
  status       text not null default 'requested' check (status in ('requested','approved','ordered','delivered','rejected')),
  notes        text,
  requested_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_mr_project on public.material_requests(project_id, status);
create index if not exists idx_mr_requester on public.material_requests(requested_by);
drop trigger if exists trg_mr_updated on public.material_requests;
create trigger trg_mr_updated before update on public.material_requests for each row execute function public.set_updated_at();
drop trigger if exists trg_mr_code on public.material_requests;
create trigger trg_mr_code before insert on public.material_requests for each row execute function public.assign_doc_code('MR');
drop trigger if exists trg_mr_code_immutable on public.material_requests;
create trigger trg_mr_code_immutable before update on public.material_requests for each row execute function public.forbid_code_change();

-- budget vs committed vs billed vs paid per project and cost head (row level security of the caller applies)
create or replace view public.finance_summary with (security_invoker = true) as
with keys as (
  select project_id, cost_head_id from public.budgets
  union select project_id, cost_head_id from public.work_orders
)
select k.project_id, k.cost_head_id,
  coalesce((select b.amount from public.budgets b where b.project_id = k.project_id and b.cost_head_id = k.cost_head_id), 0) as budget,
  coalesce((select sum(w.amount) from public.work_orders w where w.project_id = k.project_id and w.cost_head_id = k.cost_head_id and w.status in ('approved','closed')), 0) as committed,
  coalesce((select sum(r.gross_amount) from public.ra_bills r join public.work_orders w on w.id = r.work_order_id
             where w.project_id = k.project_id and w.cost_head_id = k.cost_head_id and r.status in ('approved','paid')), 0) as billed,
  coalesce((select sum(p.amount) from public.payments p join public.ra_bills r on r.id = p.bill_id join public.work_orders w on w.id = r.work_order_id
             where w.project_id = k.project_id and w.cost_head_id = k.cost_head_id), 0) as paid
from keys k;
grant select on public.finance_summary to authenticated;
revoke all on public.finance_summary from anon;
