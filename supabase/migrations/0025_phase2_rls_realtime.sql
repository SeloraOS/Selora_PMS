-- Phase 2, part 4: row level security, audit, realtime for the site tables.

do $$
declare t text;
begin
  foreach t in array array['trades','snag_categories','daily_reports','daily_report_work','daily_report_manpower','snags','approvals'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- lookups: readable by everyone signed in, managed by staff
drop policy if exists trades_read on public.trades;           create policy trades_read on public.trades for select to authenticated using (true);
drop policy if exists trades_write on public.trades;          create policy trades_write on public.trades for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists snag_categories_read on public.snag_categories;   create policy snag_categories_read on public.snag_categories for select to authenticated using (true);
drop policy if exists snag_categories_write on public.snag_categories;  create policy snag_categories_write on public.snag_categories for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- daily reports: internal users see their projects' reports; contractors their own drafts; clients only shared + submitted
drop policy if exists dpr_read on public.daily_reports;
create policy dpr_read on public.daily_reports for select to authenticated using (
  public.can_access_project(project_id) and (
    public.is_internal()
    or created_by = auth.uid()
    or (visibility = 'shared' and status = 'submitted')
  )
);
drop policy if exists dpr_insert on public.daily_reports;
create policy dpr_insert on public.daily_reports for insert to authenticated with check (
  public.can_access_project(project_id) and created_by = auth.uid()
  and (public.is_internal() or (public.current_app_role() = 'contractor' and status = 'draft' and visibility = 'internal'))
);
drop policy if exists dpr_update on public.daily_reports;
create policy dpr_update on public.daily_reports for update to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or (created_by = auth.uid() and status = 'draft' and public.current_app_role() = 'contractor')))
  with check (public.can_access_project(project_id) and (public.is_internal() or (created_by = auth.uid() and public.current_app_role() = 'contractor' and visibility = 'internal')));
drop policy if exists dpr_delete on public.daily_reports;
create policy dpr_delete on public.daily_reports for delete to authenticated
  using (public.is_staff() or (created_by = auth.uid() and status = 'draft'));

do $$
declare t text;
begin
  foreach t in array array['daily_report_work','daily_report_manpower'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (exists (select 1 from public.daily_reports r where r.id = report_id))', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated
      using (exists (select 1 from public.daily_reports r where r.id = report_id and (public.is_internal() or (r.created_by = auth.uid() and r.status = ''draft''))))
      with check (exists (select 1 from public.daily_reports r where r.id = report_id and (public.is_internal() or (r.created_by = auth.uid() and r.status = ''draft''))))', t);
  end loop;
end $$;

-- snags
drop policy if exists snags_read on public.snags;
create policy snags_read on public.snags for select to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or visibility = 'shared' or reported_by = auth.uid()));
drop policy if exists snags_insert on public.snags;
create policy snags_insert on public.snags for insert to authenticated
  with check (public.can_access_project(project_id) and reported_by = auth.uid());
drop policy if exists snags_update on public.snags;
create policy snags_update on public.snags for update to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and assignee_id = auth.uid())))
  with check (public.can_access_project(project_id) and (public.is_internal() or (public.current_app_role() = 'contractor' and assignee_id = auth.uid())));
drop policy if exists snags_delete on public.snags;
create policy snags_delete on public.snags for delete to authenticated
  using (public.is_staff() or (public.is_internal() and reported_by = auth.uid()));

-- approvals: internal only
drop policy if exists approvals_read on public.approvals;
create policy approvals_read on public.approvals for select to authenticated using (public.is_internal() and public.can_access_project(project_id));
drop policy if exists approvals_write on public.approvals;
create policy approvals_write on public.approvals for all to authenticated
  using (public.is_internal() and public.can_access_project(project_id)) with check (public.is_internal() and public.can_access_project(project_id));

-- audit + realtime
do $$
declare t text;
begin
  foreach t in array array['daily_reports','snags','approvals'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s for each row execute function public.audit_row()', t);
  end loop;
  foreach t in array array['trades','snag_categories','daily_reports','daily_report_work','daily_report_manpower','snags','approvals'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
