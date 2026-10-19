-- Phase 3 demo data: vendors, budgets, work orders, RA bills, payments. Run after seed_demo*.sql. Idempotent.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@seloraos.online');
  p uuid; v1 uuid; v2 uuid; v3 uuid; h_civil uuid; h_mep uuid; h_fin uuid; h_appr uuid;
  wo1 uuid; wo2 uuid; b1 uuid; b2 uuid;
begin
  if u is null then return; end if;
  perform set_config('request.jwt.claim.sub', u::text, true); -- act as the demo admin so the approval rules apply
  select id into p from public.projects where project_name = 'Skyline Residency - Tower A' and created_by = u;
  if p is null or exists (select 1 from public.work_orders where project_id = p) then return; end if;

  insert into public.vendors (name, category, gstin, pan, contact_name, phone) values
    ('Shree Constructions', 'Civil', '27AAAPL1234C1Z5', 'AAAPL1234C', 'Mahesh Patil', '+91 98200 11111'),
    ('Bright Electricals', 'Electrical', '27BBBPK5678D1Z2', 'BBBPK5678D', 'Imran Shaikh', '+91 98200 22222'),
    ('Finishline Interiors', 'Finishing', '27CCCPM9012E1Z8', 'CCCPM9012E', 'Anita Rao', '+91 98200 33333')
  on conflict (name) do nothing;
  select id into v1 from public.vendors where name = 'Shree Constructions';
  select id into v2 from public.vendors where name = 'Bright Electricals';
  select id into v3 from public.vendors where name = 'Finishline Interiors';
  select id into h_civil from public.cost_heads where name = 'Civil & structure';
  select id into h_mep from public.cost_heads where name = 'MEP';
  select id into h_fin from public.cost_heads where name = 'Finishing';
  select id into h_appr from public.cost_heads where name = 'Approvals & statutory';

  insert into public.budgets (project_id, cost_head_id, amount) values
    (p, h_civil, 42000000), (p, h_mep, 9000000), (p, h_fin, 7500000), (p, h_appr, 2500000)
  on conflict (project_id, cost_head_id) do nothing;

  insert into public.work_orders (project_id, vendor_id, cost_head_id, title, amount, status, start_date, end_date, created_by)
  values (p, v1, h_civil, 'RCC structure, floors 1 to 16', 36000000, 'approved', current_date - 120, current_date + 200, u) returning id into wo1;
  insert into public.work_orders (project_id, vendor_id, cost_head_id, title, amount, status, start_date, end_date, created_by)
  values (p, v2, h_mep, 'Electrical conduiting and wiring, Tower A', 8200000, 'approved', current_date - 60, current_date + 260, u) returning id into wo2;
  insert into public.work_orders (project_id, vendor_id, cost_head_id, title, amount, status, created_by)
  values (p, v3, h_fin, 'Flooring and painting, floors 1 to 8', 3800000, 'pending_approval', u);

  insert into public.ra_bills (work_order_id, period_from, period_to, gross_amount, status, created_by)
  values (wo1, current_date - 120, current_date - 90, 6500000, 'submitted', u) returning id into b1;
  update public.ra_bills set status = 'approved' where id = b1;
  insert into public.payments (bill_id, payment_date, mode, reference, amount) values (b1, current_date - 70, 'Bank transfer', 'UTR2026001', 4000000);
  insert into public.ra_bills (work_order_id, period_from, period_to, gross_amount, status, created_by)
  values (wo1, current_date - 89, current_date - 60, 5800000, 'submitted', u) returning id into b2;
  update public.ra_bills set status = 'approved' where id = b2;
  insert into public.ra_bills (work_order_id, period_from, period_to, gross_amount, status, created_by)
  values (wo2, current_date - 59, current_date - 30, 1500000, 'submitted', u);

  insert into public.material_requests (project_id, item, quantity, unit, needed_by, status, requested_by)
  values (p, 'Cement OPC 53 grade', 800, 'bags', current_date + 5, 'requested', u), (p, 'TMT bars 16 mm', 12, 'tonnes', current_date + 9, 'approved', u);
end $$;
