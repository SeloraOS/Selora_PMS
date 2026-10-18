-- Row level security: signed-in users only; anon has no access

do $$
declare t text;
begin
  foreach t in array array['profiles','doc_counters','project_types','activity_types','activity_costs',
                           'project_templates','project_template_tasks',
                           'projects','project_tasks','timesheets','timesheet_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- doc_counters is only touched by triggers
revoke all on public.doc_counters from authenticated;
grant execute on function public.next_doc_code(text,int) to authenticated;

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.current_role_is('admin')) with check (public.current_role_is('admin'));

-- setup tables: everyone reads, admin/manager write
do $$
declare t text;
begin
  foreach t in array array['project_types','activity_types','activity_costs','project_templates','project_template_tasks'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_write on public.%1$s', t);
    execute format('create policy %1$s_write on public.%1$s for all to authenticated
                    using (public.current_role_is(''admin'',''manager''))
                    with check (public.current_role_is(''admin'',''manager''))', t);
  end loop;
end $$;

-- core tables: everyone reads/creates/updates; delete = admin/manager or the creator
do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (true)', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated
                    using (created_by = auth.uid() or public.current_role_is(''admin'',''manager''))', t);
  end loop;
end $$;

drop policy if exists entries_all on public.timesheet_entries;
create policy entries_all on public.timesheet_entries for all to authenticated using (true) with check (true);
