-- Phase 3, part 4: row level security, audit, realtime. Clients never see finance; contractors only their own vendor's documents.

do $$
declare t text;
begin
  foreach t in array array['cost_heads','vendors','budgets','budget_revisions','work_orders','ra_bills','payments','material_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

drop policy if exists cost_heads_read on public.cost_heads;  create policy cost_heads_read on public.cost_heads for select to authenticated using (public.is_internal());
drop policy if exists cost_heads_write on public.cost_heads; create policy cost_heads_write on public.cost_heads for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists vendors_read on public.vendors;
create policy vendors_read on public.vendors for select to authenticated using (public.is_internal() or profile_id = auth.uid());
drop policy if exists vendors_write on public.vendors;
create policy vendors_write on public.vendors for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists budgets_read on public.budgets;
create policy budgets_read on public.budgets for select to authenticated using (public.is_internal() and public.can_access_project(project_id));
drop policy if exists budgets_write on public.budgets;
create policy budgets_write on public.budgets for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists budget_revisions_read on public.budget_revisions;
create policy budget_revisions_read on public.budget_revisions for select to authenticated using (public.is_internal() and exists (select 1 from public.budgets b where b.id = budget_id));

drop policy if exists wo_read on public.work_orders;
create policy wo_read on public.work_orders for select to authenticated using (
  public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and vendor_id in (select public.my_vendor_ids())))
);
drop policy if exists wo_insert on public.work_orders;
create policy wo_insert on public.work_orders for insert to authenticated with check (public.is_internal() and public.can_access_project(project_id) and created_by = auth.uid());
drop policy if exists wo_update on public.work_orders;
create policy wo_update on public.work_orders for update to authenticated using (public.is_internal() and public.can_access_project(project_id)) with check (public.is_internal() and public.can_access_project(project_id));
drop policy if exists wo_delete on public.work_orders;
create policy wo_delete on public.work_orders for delete to authenticated using (public.is_staff() or (public.is_internal() and created_by = auth.uid() and status = 'draft'));

drop policy if exists bills_read on public.ra_bills;
create policy bills_read on public.ra_bills for select to authenticated using (
  public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and vendor_id in (select public.my_vendor_ids())))
);
drop policy if exists bills_insert on public.ra_bills;
create policy bills_insert on public.ra_bills for insert to authenticated with check (
  created_by = auth.uid() and exists (select 1 from public.work_orders w where w.id = work_order_id and public.can_access_project(w.project_id)
    and (public.is_internal() or (public.current_app_role() = 'contractor' and w.vendor_id in (select public.my_vendor_ids()))))
);
drop policy if exists bills_update on public.ra_bills;
create policy bills_update on public.ra_bills for update to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and status = 'draft' and vendor_id in (select public.my_vendor_ids()))))
  with check (public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and vendor_id in (select public.my_vendor_ids()))));
drop policy if exists bills_delete on public.ra_bills;
create policy bills_delete on public.ra_bills for delete to authenticated using (public.is_staff() or (status = 'draft' and created_by = auth.uid()));

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated using (exists (select 1 from public.ra_bills b where b.id = bill_id));
drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists mr_read on public.material_requests;
create policy mr_read on public.material_requests for select to authenticated using (public.is_internal() and public.can_access_project(project_id));
drop policy if exists mr_write on public.material_requests;
create policy mr_write on public.material_requests for all to authenticated using (public.is_internal() and public.can_access_project(project_id)) with check (public.is_internal() and public.can_access_project(project_id));

do $$
declare t text;
begin
  foreach t in array array['vendors','budgets','work_orders','ra_bills','payments','material_requests'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
  foreach t in array array['cost_heads','vendors','budgets','budget_revisions','work_orders','ra_bills','payments','material_requests'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
