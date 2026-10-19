-- Phase 1, part 4: row level security by role and project membership.
-- Backward compatible: admin/manager keep full access, members keep seeing everything while members_see_all is on.

-- ── projects ────────────────────────────────────────────────────────────────
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (public.can_access_project(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (public.is_internal());
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.is_internal() and public.can_access_project(id)) with check (public.is_internal() and public.can_access_project(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_staff() or (public.is_internal() and created_by = auth.uid()));

-- ── tasks ───────────────────────────────────────────────────────────────────
drop policy if exists project_tasks_read on public.project_tasks;
create policy project_tasks_read on public.project_tasks for select to authenticated
  using ((project_id is null and public.is_internal()) or (project_id is not null and public.can_access_project(project_id)));
drop policy if exists project_tasks_insert on public.project_tasks;
create policy project_tasks_insert on public.project_tasks for insert to authenticated with check (public.is_internal());
drop policy if exists project_tasks_update on public.project_tasks;
create policy project_tasks_update on public.project_tasks for update to authenticated
  using (
    (public.is_internal() and (project_id is null or public.can_access_project(project_id)))
    or (public.current_app_role() = 'contractor' and assignee_id = auth.uid() and public.can_access_project(project_id))
  )
  with check (
    (public.is_internal() and (project_id is null or public.can_access_project(project_id)))
    or (public.current_app_role() = 'contractor' and assignee_id = auth.uid() and public.can_access_project(project_id))
  );
drop policy if exists project_tasks_delete on public.project_tasks;
create policy project_tasks_delete on public.project_tasks for delete to authenticated
  using (public.is_staff() or (public.is_internal() and created_by = auth.uid()));

drop policy if exists task_dependencies_all on public.task_dependencies;
drop policy if exists task_dependencies_read on public.task_dependencies;
create policy task_dependencies_read on public.task_dependencies for select to authenticated
  using (exists (select 1 from public.project_tasks t where t.id = task_id and ((t.project_id is null and public.is_internal()) or (t.project_id is not null and public.can_access_project(t.project_id)))));
drop policy if exists task_dependencies_write on public.task_dependencies;
create policy task_dependencies_write on public.task_dependencies for all to authenticated
  using (public.is_internal()) with check (public.is_internal());

-- ── timesheets (internal cost data: never visible to clients/contractors) ──
drop policy if exists timesheets_read on public.timesheets;
create policy timesheets_read on public.timesheets for select to authenticated
  using (public.is_internal() and (project_id is null or public.can_access_project(project_id)));
drop policy if exists timesheets_insert on public.timesheets;
create policy timesheets_insert on public.timesheets for insert to authenticated with check (public.is_internal());
drop policy if exists timesheets_update on public.timesheets;
create policy timesheets_update on public.timesheets for update to authenticated
  using (public.is_internal() and (project_id is null or public.can_access_project(project_id)))
  with check (public.is_internal() and (project_id is null or public.can_access_project(project_id)));
drop policy if exists timesheets_delete on public.timesheets;
create policy timesheets_delete on public.timesheets for delete to authenticated
  using (public.is_staff() or (public.is_internal() and created_by = auth.uid()));
drop policy if exists entries_all on public.timesheet_entries;
create policy entries_all on public.timesheet_entries for all to authenticated
  using (public.is_internal() and exists (select 1 from public.timesheets s where s.id = timesheet_id))
  with check (public.is_internal() and exists (select 1 from public.timesheets s where s.id = timesheet_id));

-- ── updates: clients only see the ones shared with them ─────────────────────
drop policy if exists project_updates_read on public.project_updates;
create policy project_updates_read on public.project_updates for select to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or visibility = 'shared'));
drop policy if exists project_updates_insert on public.project_updates;
create policy project_updates_insert on public.project_updates for insert to authenticated
  with check (public.is_internal() and public.can_access_project(project_id));
drop policy if exists project_updates_update on public.project_updates;
create policy project_updates_update on public.project_updates for update to authenticated
  using (public.is_internal() and public.can_access_project(project_id)) with check (public.is_internal() and public.can_access_project(project_id));
drop policy if exists project_updates_delete on public.project_updates;
create policy project_updates_delete on public.project_updates for delete to authenticated
  using (public.is_staff() or (public.is_internal() and created_by = auth.uid()));

-- ── project members ─────────────────────────────────────────────────────────
drop policy if exists project_users_all on public.project_users;
drop policy if exists project_users_read on public.project_users;
create policy project_users_read on public.project_users for select to authenticated
  using ((public.is_internal() and public.can_access_project(project_id)) or profile_id = auth.uid());
drop policy if exists project_users_write on public.project_users;
create policy project_users_write on public.project_users for all to authenticated
  using (public.is_staff() or public.my_project_role(project_id) = 'owner')
  with check (public.is_staff() or public.my_project_role(project_id) = 'owner');

-- ── internal-only configuration and rates ──────────────────────────────────
drop policy if exists activity_types_read on public.activity_types;
create policy activity_types_read on public.activity_types for select to authenticated using (public.is_internal());
drop policy if exists activity_costs_read on public.activity_costs;
create policy activity_costs_read on public.activity_costs for select to authenticated using (public.is_internal());
drop policy if exists pm_settings_read on public.pm_settings;
create policy pm_settings_read on public.pm_settings for select to authenticated using (public.is_internal());
drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select to authenticated using (public.is_internal());

-- ── profiles: externals only see themselves and people on their projects ──
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  public.is_internal()
  or id = auth.uid()
  or exists (select 1 from public.project_users a join public.project_users b on a.project_id = b.project_id
              where a.profile_id = auth.uid() and b.profile_id = profiles.id)
);

-- ── attachments ─────────────────────────────────────────────────────────────
alter table public.attachments enable row level security;
revoke all on public.attachments from anon;
grant select, insert, update, delete on public.attachments to authenticated;
drop policy if exists attachments_read on public.attachments;
create policy attachments_read on public.attachments for select to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or visibility = 'shared'));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.can_access_project(project_id) and public.current_app_role() in ('admin','manager','member','contractor') and uploaded_by = auth.uid()
              and (public.is_internal() or visibility = 'shared'));
drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments for update to authenticated
  using (public.is_staff() or uploaded_by = auth.uid()) with check (public.is_staff() or uploaded_by = auth.uid());
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments for delete to authenticated
  using (public.is_staff() or uploaded_by = auth.uid());

-- ── comments ────────────────────────────────────────────────────────────────
alter table public.comments enable row level security;
revoke all on public.comments from anon;
grant select, insert, update, delete on public.comments to authenticated;
drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (public.can_access_project(project_id) and (public.is_internal() or visibility = 'shared'));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author = auth.uid() and public.can_access_project(project_id)
    and (public.is_internal()
         or (visibility = 'shared' and (public.current_app_role() = 'contractor'
              or (public.current_app_role() = 'client' and coalesce((select client_can_comment from public.pm_settings limit 1), true)))))
  );
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments for update to authenticated
  using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (public.is_staff() or author = auth.uid());

-- ── audit log (written by triggers only) ────────────────────────────────────
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated
  using (public.is_staff() or (public.is_internal() and project_id is not null and public.can_access_project(project_id)));

-- ── storage objects (bucket project-files) ──────────────────────────────────
drop policy if exists project_files_read on storage.objects;
create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files' and exists (select 1 from public.attachments a where a.storage_path = storage.objects.name));  -- qualified: attachments also has a "name" column
drop policy if exists project_files_insert on storage.objects;
create policy project_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and public.can_access_project(public.storage_project(name))
              and public.current_app_role() in ('admin','manager','member','contractor'));
drop policy if exists project_files_delete on storage.objects;
create policy project_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (public.is_staff() or owner = auth.uid() or owner_id = auth.uid()::text));

-- ── realtime for the new tables ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['attachments','comments'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
