-- Real-estate firm demo data. Idempotent: replaces everything created by the demo user.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@seloraos.online');
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; ts uuid;
begin
  delete from public.timesheets   where created_by = u;
  delete from public.project_tasks where created_by = u;
  delete from public.projects     where created_by = u;

  insert into public.projects (project_name, status, project_type_id, priority, department, company, estimated_cost, description,
                               expected_start_date, expected_end_date, actual_start_date, actual_end_date, created_by) values
    ('Skyline Residency - Tower A', 'Open',(select id from public.project_types where name='Residential Development'),'High','Construction','Selora Realty',420000000,'32-storey residential tower, 240 units, Powai.','2026-01-10','2028-06-30','2026-01-20',null,u),
    ('Green Valley Villas',         'Open',(select id from public.project_types where name='Residential Development'),'Medium','Construction','Selora Realty',185000000,'48 gated villas with clubhouse, Lonavala.','2026-03-01','2027-12-31','2026-03-15',null,u),
    ('Orchid Business Park',        'Open',(select id from public.project_types where name='Commercial Development'),'High','Construction','Selora Realty',650000000,'Grade-A office park, 4 blocks, Navi Mumbai.','2026-05-01','2029-03-31','2026-05-10',null,u),
    ('Skyline Launch Campaign',     'Open',(select id from public.project_types where name='Sales & Marketing'),'High','Sales','Selora Realty',12000000,'Pre-launch and launch campaign for Skyline Tower A.','2026-09-01','2026-12-31','2026-09-05',null,u),
    ('Lakeview Apartments Handover','Completed',(select id from public.project_types where name='Property Management'),'Medium','Operations','Selora Realty',8500000,'Possession, snagging and society formation for 120 units.','2026-02-01','2026-08-31','2026-02-03','2026-08-28',u),
    ('RERA & Approvals - Orchid',   'Open',(select id from public.project_types where name='Compliance & Legal'),'Urgent','Legal','Selora Realty',3500000,'RERA registration, environmental clearance, fire NOC.','2026-08-01','2026-12-15','2026-08-04',null,u)
  ;
  select id into p1 from public.projects where project_name='Skyline Residency - Tower A';
  select id into p2 from public.projects where project_name='Green Valley Villas';
  select id into p3 from public.projects where project_name='Orchid Business Park';
  select id into p4 from public.projects where project_name='Skyline Launch Campaign';
  select id into p5 from public.projects where project_name='Lakeview Apartments Handover';
  select id into p6 from public.projects where project_name='RERA & Approvals - Orchid';

  insert into public.project_tasks (subject, project_id, status, priority, weight, description, expected_start_date, expected_end_date, created_by) values
    ('Land title verification',          p1,'Completed','High',  5,'Verify title chain and encumbrances.','2026-01-10','2026-02-05',u),
    ('Architectural drawings approval',  p1,'Completed','High', 10,'Final plans signed off by architect and client.','2026-02-06','2026-03-20',u),
    ('Foundation & piling',              p1,'Completed','High', 20,'Piling and raft foundation.','2026-04-01','2026-07-15',u),
    ('Structure - floors 1 to 16',       p1,'Working',  'High', 25,'RCC frame, slabs and columns.','2026-07-16','2027-03-31',u),
    ('Structure - floors 17 to 32',      p1,'Open',     'Medium',25,'Upper floor structure.','2027-04-01','2027-12-31',u),
    ('MEP and finishing',                p1,'Open',     'Medium',15,'Electrical, plumbing, lifts, finishing.','2027-10-01','2028-05-31',u),
    ('Villa plot layout & survey',       p2,'Completed','High', 10,'Plot demarcation and topographic survey.','2026-03-01','2026-04-10',u),
    ('Internal roads & drainage',        p2,'Working',  'Medium',30,'Roads, storm-water and sewage lines.','2026-04-15','2026-11-30',u),
    ('Clubhouse construction',           p2,'Open',     'Medium',30,'Clubhouse, pool and gym.','2026-11-01','2027-06-30',u),
    ('Villa handover snagging',          p2,'Open',     'Low',  30,'Pre-handover quality checks.','2027-09-01','2027-12-15',u),
    ('Soil investigation report',        p3,'Completed','High', 10,'Geotechnical survey.','2026-05-10','2026-06-20',u),
    ('Excavation - Block A',             p3,'Working',  'High', 30,'Basement excavation and shoring.','2026-07-01','2026-12-31',u),
    ('Tenant pre-leasing',               p3,'Working',  'Medium',20,'Anchor tenant LOIs.','2026-09-01','2027-03-31',u),
    ('Contractor tender - Blocks B-D',   p3,'Overdue',  'Urgent',40,'Tender evaluation delayed.','2026-09-01','2026-10-10',u),
    ('Brochure and walkthrough video',   p4,'Completed','High', 20,'Marketing collateral.','2026-09-01','2026-09-30',u),
    ('Channel partner onboarding',       p4,'Working',  'High', 30,'Brokers and channel partners enrolment.','2026-09-15','2026-11-15',u),
    ('Launch event',                     p4,'Open',     'High', 30,'Launch weekend at the site office.','2026-11-20','2026-11-22',u),
    ('Digital ads and lead tracking',    p4,'Working',  'Medium',20,'Meta and Google campaigns.','2026-09-05','2026-12-31',u),
    ('Unit inspection and snag list',    p5,'Completed','High', 40,'Inspect all 120 units.','2026-02-03','2026-05-30',u),
    ('Possession letters & agreements',  p5,'Completed','Medium',30,'Legal handover documents.','2026-05-01','2026-07-31',u),
    ('Society registration',             p5,'Completed','Low',  30,'Co-operative society formation.','2026-06-01','2026-08-28',u),
    ('RERA project registration',        p6,'Working',  'Urgent',40,'Submit RERA application.','2026-08-04','2026-10-31',u),
    ('Environmental clearance',          p6,'Open',     'High', 30,'EC application and public hearing.','2026-10-15','2026-12-15',u),
    ('Fire NOC',                         p6,'Overdue',  'High', 30,'Pending fire department inspection.','2026-09-01','2026-10-05',u);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Submitted', p1, 'Skyline Tower A Buyers Group', 'Rohan Mehta', 'Site supervision, structure floors 12-14', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Site Supervision','2026-10-12 08:00',8,p1,true,0),
    (ts,'Client Meeting',  '2026-10-13 15:00',2,p1,true,1),
    (ts,'Site Visit',      '2026-10-14 09:00',4,p2,false,2);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Submitted', p6, 'Orchid Business Park LLP', 'Neha Kapoor', 'RERA filing and document review', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Legal & Documentation','2026-10-12 10:00',6,p6,true,0),
    (ts,'Legal & Documentation','2026-10-13 10:00',5,p6,true,1),
    (ts,'Client Meeting',       '2026-10-14 11:00',1.5,p6,true,2);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Draft', p4, 'Internal', 'Aarav Shah', 'Launch campaign prep', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Marketing',      '2026-10-15 10:00',5,p4,false,0),
    (ts,'Sales Follow-up','2026-10-16 10:00',3,p4,false,1);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Billed', p5, 'Lakeview Co-operative Society', 'Priya Nair', 'Handover support and snagging', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Property Inspection','2026-08-10 09:00',8,p5,true,0),
    (ts,'Property Inspection','2026-08-11 09:00',8,p5,true,1),
    (ts,'Legal & Documentation','2026-08-12 10:00',4,p5,true,2);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Submitted', p3, 'Orchid Business Park LLP', 'Rohan Mehta', 'Excavation monitoring and tender review', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Site Supervision','2026-10-14 08:00',7,p3,true,0),
    (ts,'Architecture & Design','2026-10-15 11:00',3,p3,true,1);

  insert into public.timesheets (status, project_id, customer, employee, note, created_by)
  values ('Draft', p2, 'Green Valley Villas', 'Priya Nair', 'Road works inspection', u) returning id into ts;
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, is_billable, sort_order) values
    (ts,'Site Visit','2026-10-16 09:00',6,p2,true,0);
end $$;
