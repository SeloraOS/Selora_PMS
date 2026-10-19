-- Demo data layer 2: rates, templates, project updates, task links. Run after seed.sql + seed_demo.sql. Idempotent.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@seloraos.online');
begin
  -- the demo account is the dev admin (credentials live only in the gitignored .env.local)
  update public.profiles set role = 'admin' where email = 'demo@seloraos.online';

  update public.activity_types set billing_type = 'Hourly';
  update public.activity_types set billing_type = 'Daily' where name in ('Site Supervision','Property Inspection');

  -- employee-specific rates (override the activity type defaults)
  delete from public.activity_costs;
  insert into public.activity_costs (employee, activity_type_id, billing_rate, costing_rate)
  select e.employee, a.id, e.billing, e.costing
  from (values
    ('Rohan Mehta','Site Supervision',1500,800),
    ('Rohan Mehta','Client Meeting',1200,600),
    ('Neha Kapoor','Legal & Documentation',2200,1100),
    ('Priya Nair','Property Inspection',1300,700),
    ('Aarav Shah','Marketing',1000,550)
  ) as e(employee, act, billing, costing)
  join public.activity_types a on a.name = e.act;

  -- re-resolve entry rates now that employee rates exist
  update public.timesheet_entries e set billing_rate = null, costing_rate = null
   from public.timesheets t where t.id = e.timesheet_id and t.created_by = u;

  -- templates
  delete from public.project_templates where name in ('Residential Tower Template','Marketing Launch Template');
  with t as (
    insert into public.project_templates (name, project_type_id)
    select 'Residential Tower Template', id from public.project_types where name='Residential Development'
    returning id
  ) insert into public.project_template_tasks (template_id, subject, description, start_day, duration, sort_order)
    select t.id, x.subject, x.descr, x.start_day, x.duration, x.ord from t,
    (values ('Land title verification','Title chain and encumbrances',0,25,0),
            ('Architectural approvals','Plans signed off',26,45,1),
            ('Foundation and piling','Piling and raft',70,105,2),
            ('Superstructure','RCC frame',175,365,3),
            ('MEP and finishing','Services and finishing',540,210,4)) as x(subject,descr,start_day,duration,ord);
  with t as (
    insert into public.project_templates (name, project_type_id)
    select 'Marketing Launch Template', id from public.project_types where name='Sales & Marketing'
    returning id
  ) insert into public.project_template_tasks (template_id, subject, description, start_day, duration, sort_order)
    select t.id, x.subject, x.descr, x.start_day, x.duration, x.ord from t,
    (values ('Collateral and brochure','Brochure, video, site hoarding',0,30,0),
            ('Channel partner onboarding','Brokers enrolment',15,60,1),
            ('Launch event','Launch weekend',75,3,2)) as x(subject,descr,start_day,duration,ord);

  -- project updates
  delete from public.project_updates where created_by = u;
  insert into public.project_updates (project_id, type, description, update_date, sent_to, created_by)
  select p.id, x.type, x.descr, x.d::date, x.sent, u
  from (values
    ('Skyline Residency - Tower A','Progress','Floors 1-14 slab casting complete; floor 15 shuttering under way.','2026-10-12','Directors'),
    ('Skyline Residency - Tower A','Milestone','Piling certified by structural consultant.','2026-07-18','Directors'),
    ('Green Valley Villas','Progress','Internal roads 60% complete; drainage lines laid for phases 1-2.','2026-10-10','Project Head'),
    ('Orchid Business Park','Issue','Contractor tender for Blocks B-D delayed; bids under re-evaluation.','2026-10-11','Directors'),
    ('Lakeview Apartments Handover','Milestone','All 120 units handed over; society registered.','2026-08-28','Directors'),
    ('RERA & Approvals - Orchid','Issue','Fire department inspection slot not yet confirmed.','2026-10-13','Legal Head')
  ) as x(proj, type, descr, d, sent)
  join public.projects p on p.project_name = x.proj;

  -- task links: parent (group) + dependencies
  update public.project_tasks set is_group = true where subject in ('Structure - floors 1 to 16','Excavation - Block A');
  update public.project_tasks c set parent_task_id = p.id
    from public.project_tasks p
   where c.created_by = u and p.created_by = u
     and ((c.subject = 'Structure - floors 17 to 32' and p.subject = 'Structure - floors 1 to 16'));

  delete from public.task_dependencies where task_id in (select id from public.project_tasks where created_by = u);
  insert into public.task_dependencies (task_id, depends_on_id)
  select a.id, b.id from (values
    ('Architectural drawings approval','Land title verification'),
    ('Foundation & piling','Architectural drawings approval'),
    ('Structure - floors 1 to 16','Foundation & piling'),
    ('Structure - floors 17 to 32','Structure - floors 1 to 16'),
    ('MEP and finishing','Structure - floors 17 to 32'),
    ('Launch event','Channel partner onboarding'),
    ('Environmental clearance','RERA project registration')
  ) as d(t, dep)
  join public.project_tasks a on a.subject = d.t and a.created_by = u
  join public.project_tasks b on b.subject = d.dep and b.created_by = u;

  -- customers, sales orders, holiday lists, templates and project users
  update public.projects set holiday_list = 'Standard Corporate' where created_by = u and holiday_list is null;
  update public.projects set holiday_list = 'Factory Shift' where created_by = u and project_name in ('Green Valley Villas', 'Orchid Business Park');
  update public.projects set from_template = 'Residential Tower Template' where created_by = u and project_name = 'Skyline Residency - Tower A';
  update public.projects set from_template = 'Marketing Launch Template' where created_by = u and project_name = 'Skyline Launch Campaign';
  update public.projects p set customer = x.customer, sales_order = x.so
    from (values
      ('Skyline Residency - Tower A','Skyline Tower A Buyers Group','SO-2026-001'),
      ('Green Valley Villas','Green Valley Villas Owners','SO-2026-002'),
      ('Orchid Business Park','Orchid Business Park LLP','SO-2026-003'),
      ('Skyline Launch Campaign','Internal','SO-2026-004'),
      ('Lakeview Apartments Handover','Lakeview Co-operative Society','SO-2026-005'),
      ('RERA & Approvals - Orchid','Orchid Business Park LLP','SO-2026-006')
    ) as x(name, customer, so)
   where p.project_name = x.name and p.created_by = u;

  delete from public.project_users where project_id in (select id from public.projects where created_by = u);
  insert into public.project_users (project_id, user_email, full_name, sort_order)
  select p.id, x.email, x.fname, x.ord
  from public.projects p
  join (values
    ('Skyline Residency - Tower A','rohan.mehta@selora.test','Rohan Mehta',0),
    ('Skyline Residency - Tower A','neha.kapoor@selora.test','Neha Kapoor',1),
    ('Green Valley Villas','priya.nair@selora.test','Priya Nair',0),
    ('Orchid Business Park','rohan.mehta@selora.test','Rohan Mehta',0),
    ('Skyline Launch Campaign','aarav.shah@selora.test','Aarav Shah',0),
    ('RERA & Approvals - Orchid','neha.kapoor@selora.test','Neha Kapoor',0)
  ) as x(proj, email, fname, ord) on x.proj = p.project_name
  where p.created_by = u;

  -- timesheet rows reference an active task of their project
  update public.timesheet_entries e
     set task_id = (select t.id from public.project_tasks t
                     where t.project_id = e.project_id and t.status in ('Open','Working','Pending','Overdue')
                     order by t.created_at limit 1)
   where e.project_id in (select id from public.projects where created_by = u) and e.task_id is null;

  -- default holiday list shown on the calendar
  update public.pm_settings set holiday_list = 'Standard Corporate' where holiday_list is null;
end $$;
