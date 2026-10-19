-- Phase 2 demo data: daily reports, snags, approvals, baselines. Run after seed_demo*.sql. Idempotent.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@seloraos.online');
  p record; r uuid; t record; d int;
begin
  if u is null then return; end if;

  -- approvals on every demo project that is open
  for p in select id, project_name, expected_start_date from public.projects where created_by = u and status = 'Open' loop
    insert into public.approvals (project_id, name, authority, status, applied_on, approved_on, expiry_on, created_by)
    select p.id, x.name, x.authority, x.status, x.applied, x.approved, x.expiry, u from (values
      ('RERA registration','State RERA authority','Approved', current_date - 400, current_date - 380, current_date + 700),
      ('Commencement certificate','Municipal corporation','Approved', current_date - 300, current_date - 280, current_date + 20),
      ('Fire NOC','Fire department','Approved', current_date - 500, current_date - 480, current_date - 10),
      ('Environmental clearance','State environment impact assessment authority','Applied', current_date - 40, null::date, null::date),
      ('Occupancy certificate','Municipal corporation','Not started', null::date, null::date, null::date)
    ) as x(name, authority, status, applied, approved, expiry)
    on conflict (project_id, name) do nothing;
  end loop;

  -- snags
  insert into public.snags (project_id, title, location, category, severity, status, due_date, visibility, reported_by)
  select pj.id, x.title, x.loc, x.cat, x.sev, x.st, current_date + x.due, x.vis, u
  from public.projects pj
  cross join (values
    ('Honeycombing on column C4','Tower A, 3rd floor','Civil','High','Open',-4,'internal'),
    ('Switchboard not flush with wall','Tower A, flat 402','Electrical','Low','Open',5,'shared'),
    ('Seepage at bathroom ceiling','Tower A, flat 302','Waterproofing','Critical','Fixed',-1,'shared'),
    ('Paint patches in corridor','Tower A, 2nd floor','Finishing','Medium','Verified',-12,'shared')
  ) as x(title, loc, cat, sev, st, due, vis)
  where pj.project_name = 'Skyline Residency - Tower A' and pj.created_by = u
    and not exists (select 1 from public.snags s where s.project_id = pj.id and s.title = x.title);

  -- daily reports for the last week on the tower project
  select id, project_name into p from public.projects where project_name = 'Skyline Residency - Tower A' and created_by = u;
  if p.id is not null then
    for d in 1..6 loop
      if not exists (select 1 from public.daily_reports where project_id = p.id and report_date = current_date - d) then
        insert into public.daily_reports (project_id, report_date, weather, summary, blockers, status, visibility, created_by)
        values (p.id, current_date - d, (array['Clear','Cloudy','Light rain','Clear','Hot','Clear'])[d],
                'Slab shuttering and rebar tying continued on floor ' || (10 - d), case when d = 3 then 'Cement delivery delayed by two hours' end,
                'submitted', case when d % 2 = 0 then 'shared' else 'internal' end, u)
        returning id into r;
        insert into public.daily_report_manpower (report_id, trade, head_count, sort_order)
        values (r, 'Mason', 6 + d, 0), (r, 'Helper', 10, 1), (r, 'Steel fixer', 4, 2), (r, 'Carpenter', 3, 3);
      end if;
    end loop;
    -- baseline = current plan for the tower project
    update public.project_tasks
       set baseline_start_date = expected_start_date, baseline_end_date = expected_end_date, baseline_set_at = now()
     where project_id = p.id and baseline_set_at is null and (expected_start_date is not null or expected_end_date is not null);
  end if;
end $$;
