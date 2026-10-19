-- Demo data layer 3: more real-estate projects, tasks, time, updates. Run after seed_demo.sql + seed_demo_extra.sql.
-- Idempotent: removes and recreates only the projects named below. Dates are relative to today so overdue / recent data stays fresh.
do $$
declare
  u uuid := (select id from auth.users where email = 'demo@seloraos.online');
  names text[] := array['Palm Grove Plotting','Skyline Mall Fit-out','Riverside Rentals Drive','Monsoon Sales Campaign','Heritage Court Redevelopment','Hinjewadi Parcel Title Cleanup'];
begin
  delete from public.timesheets where created_by = u and project_id in (select id from public.projects where project_name = any(names));
  delete from public.project_tasks where project_id in (select id from public.projects where project_name = any(names));
  delete from public.projects where project_name = any(names);

  -- new employees' rates
  insert into public.activity_costs (employee, activity_type_id, billing_rate, costing_rate)
  select e.employee, a.id, e.billing, e.costing
  from (values
    ('Karan Verma','Site Supervision',1400,750), ('Karan Verma','Property Inspection',1200,650),
    ('Sneha Iyer','Marketing',1100,600), ('Sneha Iyer','Sales Follow-up',900,450),
    ('Vikram Rao','Legal & Documentation',2000,1000), ('Vikram Rao','Client Meeting',1100,550)
  ) as e(employee, act, billing, costing)
  join public.activity_types a on a.name = e.act
  where not exists (select 1 from public.activity_costs c where c.employee = e.employee and c.activity_type_id = a.id);

  -- projects (created Open; closed ones are updated at the end so auto-close cannot interfere)
  insert into public.projects (project_name, status, project_type_id, priority, department, estimated_cost, description,
                               expected_start_date, expected_end_date, actual_start_date, customer, sales_order, holiday_list, from_template, created_by)
  select x.name, 'Open', (select id from public.project_types where name = x.ptype), x.priority, x.dept, x.cost, x.descr,
         current_date + x.s, current_date + x.e, case when x.s < 0 then current_date + x.s + 2 end, x.customer, x.so,
         x.hol, x.tpl, u
  from (values
    ('Palm Grove Plotting','Residential Development','High','Construction',310000000,'120 NA plots with roads, drainage and a central park, Pune.',-120,260,'Palm Grove Plot Owners','SO-2026-007','Standard Corporate',null),
    ('Skyline Mall Fit-out','Commercial Development','Medium','Construction',95000000,'Interior fit-out of the 3-level retail podium for 60 tenants.',-45,200,'Skyline Retail Holdings','SO-2026-008','Factory Shift',null),
    ('Riverside Rentals Drive','Property Management','Medium','Operations',6500000,'Lease-up and tenant onboarding for 84 rental apartments.',-30,60,'Riverside Landlords Association','SO-2026-009','Standard Corporate',null),
    ('Monsoon Sales Campaign','Sales & Marketing','High','Sales',9000000,'Festive-season offers across channel partners and digital.',-20,70,'Internal','SO-2026-010','Standard Corporate','Marketing Launch Template'),
    ('Heritage Court Redevelopment','Residential Development','Low','Construction',240000000,'Society redevelopment, put on hold after approval delays.',-200,150,'Heritage Court CHS','SO-2026-011','Standard Corporate',null),
    ('Hinjewadi Parcel Title Cleanup','Compliance & Legal','Urgent','Legal',4200000,'Title clearance, mutation and NA conversion for a 12-acre parcel.',-60,40,'Hinjewadi Land Holdings LLP','SO-2026-012','Standard Corporate',null)
  ) as x(name, ptype, priority, dept, cost, descr, s, e, customer, so, hol, tpl);

  -- tasks: project, subject, status, priority, weight, start offset, end offset, group?
  create temp table tmp_tasks on commit drop as
  select * from (values
    ('Palm Grove Plotting','Survey and plot demarcation','Completed','High',10,-120,-90,false),
    ('Palm Grove Plotting','Road network construction','Working','High',30,-80,40,true),
    ('Palm Grove Plotting','Road base layers','Completed','Medium',15,-80,-30,false),
    ('Palm Grove Plotting','Asphalting and kerbs','Working','Medium',15,-20,40,false),
    ('Palm Grove Plotting','Storm-water drainage','Working','High',20,-60,15,false),
    ('Palm Grove Plotting','Central park landscaping','Open','Low',20,60,200,false),
    ('Palm Grove Plotting','Plot registry and handover','Open','Medium',20,150,260,false),
    ('Skyline Mall Fit-out','Tenant design approvals','Completed','High',15,-45,-20,false),
    ('Skyline Mall Fit-out','Ground floor shop fit-outs','Working','High',30,-30,60,false),
    ('Skyline Mall Fit-out','Food court services','Pending','Medium',20,-5,70,false),
    ('Skyline Mall Fit-out','Signage and wayfinding','Open','Low',10,50,120,false),
    ('Skyline Mall Fit-out','Fire and safety certification','Overdue','Urgent',25,-30,-6,false),
    ('Riverside Rentals Drive','Rent roll and pricing','Completed','Medium',20,-30,-20,false),
    ('Riverside Rentals Drive','Broker and portal listings','Working','High',30,-25,20,false),
    ('Riverside Rentals Drive','Tenant screening and agreements','Working','High',30,-15,40,false),
    ('Riverside Rentals Drive','Move-in coordination','Open','Medium',20,10,60,false),
    ('Monsoon Sales Campaign','Offer structure and approvals','Completed','High',20,-20,-12,false),
    ('Monsoon Sales Campaign','Creative and landing page','Working','High',30,-15,5,false),
    ('Monsoon Sales Campaign','Channel partner briefing','Open','Medium',20,2,12,false),
    ('Monsoon Sales Campaign','Weekend site-visit drive','Open','High',30,20,70,false),
    ('Heritage Court Redevelopment','Society consent drive','Completed','Medium',30,-200,-120,false),
    ('Heritage Court Redevelopment','Municipal plan approval','Cancelled','High',40,-110,-20,false),
    ('Heritage Court Redevelopment','Developer agreement','Cancelled','Medium',30,-90,-30,false),
    ('Hinjewadi Parcel Title Cleanup','Title search and encumbrance report','Completed','Urgent',20,-60,-40,false),
    ('Hinjewadi Parcel Title Cleanup','Mutation entries','Working','Urgent',30,-35,10,false),
    ('Hinjewadi Parcel Title Cleanup','NA conversion order','Working','High',30,-20,25,false),
    ('Hinjewadi Parcel Title Cleanup','Boundary dispute resolution','Overdue','Urgent',20,-30,-3,false)
  ) as t(project, subject, status, priority, weight, s, e, grp);

  insert into public.project_tasks (subject, project_id, status, priority, weight, expected_start_date, expected_end_date, actual_end_date, is_group, company, created_by)
  select t.subject, p.id, t.status, t.priority, t.weight, current_date + t.s, current_date + t.e,
         case when t.status = 'Completed' then current_date + t.e end, t.grp, 'Selora Realty', u
  from tmp_tasks t join public.projects p on p.project_name = t.project;

  -- parent task and dependencies
  update public.project_tasks c set parent_task_id = p.id
    from public.project_tasks p
   where p.project_id = c.project_id and p.subject = 'Road network construction'
     and c.subject in ('Road base layers','Asphalting and kerbs') and c.project_id in (select id from public.projects where project_name = 'Palm Grove Plotting');

  insert into public.task_dependencies (task_id, depends_on_id)
  select a.id, b.id
  from (values
    ('Palm Grove Plotting','Road network construction','Survey and plot demarcation'),
    ('Palm Grove Plotting','Storm-water drainage','Survey and plot demarcation'),
    ('Palm Grove Plotting','Central park landscaping','Road network construction'),
    ('Skyline Mall Fit-out','Ground floor shop fit-outs','Tenant design approvals'),
    ('Skyline Mall Fit-out','Signage and wayfinding','Ground floor shop fit-outs'),
    ('Riverside Rentals Drive','Tenant screening and agreements','Broker and portal listings'),
    ('Monsoon Sales Campaign','Weekend site-visit drive','Channel partner briefing'),
    ('Hinjewadi Parcel Title Cleanup','NA conversion order','Mutation entries')
  ) as d(proj, task, dep)
  join public.projects p on p.project_name = d.proj
  join public.project_tasks a on a.project_id = p.id and a.subject = d.task
  join public.project_tasks b on b.project_id = p.id and b.subject = d.dep
  on conflict do nothing;

  -- timesheets
  create temp table tmp_ts on commit drop as
  select * from (values
    (1,'Karan Verma','Palm Grove Plotting','Palm Grove Plot Owners','Road works supervision week 1','Submitted'),
    (2,'Karan Verma','Palm Grove Plotting','Palm Grove Plot Owners','Road works supervision week 2','Draft'),
    (3,'Rohan Mehta','Skyline Mall Fit-out','Skyline Retail Holdings','Tenant coordination and site checks','Submitted'),
    (4,'Priya Nair','Skyline Mall Fit-out','Skyline Retail Holdings','Fire NOC follow-up and inspections','Draft'),
    (5,'Sneha Iyer','Monsoon Sales Campaign','Internal','Creative reviews and partner calls','Submitted'),
    (6,'Sneha Iyer','Riverside Rentals Drive','Riverside Landlords Association','Listing and enquiry follow-ups','Billed'),
    (7,'Vikram Rao','Hinjewadi Parcel Title Cleanup','Hinjewadi Land Holdings LLP','Mutation filings and hearings','Submitted'),
    (8,'Neha Kapoor','Hinjewadi Parcel Title Cleanup','Hinjewadi Land Holdings LLP','NA conversion paperwork','Billed'),
    (9,'Aarav Shah','Monsoon Sales Campaign','Internal','Landing page and ads','Draft'),
    (10,'Priya Nair','Heritage Court Redevelopment','Heritage Court CHS','Closing documentation','Cancelled')
  ) as t(k, employee, project, customer, note, status);

  create temp table tmp_ts_ids (k int primary key, id uuid) on commit drop;
  with ins as (
    insert into public.timesheets (employee, project_id, customer, note, status, created_by)
    select t.employee, p.id, t.customer, t.note, t.status, u
    from tmp_ts t join public.projects p on p.project_name = t.project
    returning id, employee, note
  )
  insert into public.timesheet_entries (timesheet_id, activity_type, from_time, hours, project_id, task_id, is_billable, sort_order)
  select ins.id, e.act, (current_date + e.d)::timestamp + make_interval(hours => e.h), e.hrs, p.id,
         (select t.id from public.project_tasks t where t.project_id = p.id and t.subject = e.task), e.billable, e.ord
  from ins
  join tmp_ts k on k.employee = ins.employee and k.note = ins.note
  join (values
    (1,'Site Supervision',-9,8,8,'Road network construction',true,0),
    (1,'Site Supervision',-8,8,7.5,'Storm-water drainage',true,1),
    (1,'Client Meeting',-6,15,1.5,'Asphalting and kerbs',true,2),
    (2,'Site Supervision',-3,8,8,'Asphalting and kerbs',true,0),
    (2,'Property Inspection',-2,9,4,'Storm-water drainage',false,1),
    (3,'Client Meeting',-12,11,2,'Ground floor shop fit-outs',true,0),
    (3,'Site Supervision',-11,8,8,'Ground floor shop fit-outs',true,1),
    (3,'Site Visit',-10,9,5,'Food court services',false,2),
    (4,'Property Inspection',-5,9,6,'Fire and safety certification',true,0),
    (4,'Legal & Documentation',-4,10,3,'Fire and safety certification',true,1),
    (5,'Marketing',-7,10,6,'Creative and landing page',false,0),
    (5,'Sales Follow-up',-6,11,3,'Channel partner briefing',false,1),
    (6,'Sales Follow-up',-18,10,5,'Broker and portal listings',true,0),
    (6,'Marketing',-17,10,4,'Broker and portal listings',true,1),
    (7,'Legal & Documentation',-8,10,7,'Mutation entries',true,0),
    (7,'Legal & Documentation',-7,10,6.5,'Mutation entries',true,1),
    (7,'Client Meeting',-6,15,1.5,'NA conversion order',true,2),
    (8,'Legal & Documentation',-25,10,8,'Title search and encumbrance report',true,0),
    (8,'Legal & Documentation',-24,10,4,'Title search and encumbrance report',true,1),
    (9,'Marketing',-1,10,5,'Creative and landing page',false,0),
    (10,'Legal & Documentation',-40,11,2,'Society consent drive',true,0)
  ) as e(k, act, d, h, hrs, task, billable, ord) on e.k = k.k
  join public.projects p on p.project_name = k.project;

  -- project updates
  insert into public.project_updates (project_id, type, description, update_date, sent_to, created_by)
  select p.id, x.type, x.descr, current_date + x.d, x.sent, u
  from (values
    ('Palm Grove Plotting','Progress','Road base layers complete for lanes A-F; asphalting begins next week.',-6,'Directors'),
    ('Palm Grove Plotting','Issue','Drainage trench blocked by rock at Lane D; extra blasting approval needed.',-3,'Project Head'),
    ('Skyline Mall Fit-out','Milestone','Tenant design approvals closed for 52 of 60 units.',-15,'Directors'),
    ('Skyline Mall Fit-out','Issue','Fire NOC inspection still unscheduled; blocks food court handover.',-4,'Legal Head'),
    ('Riverside Rentals Drive','Progress','61 of 84 apartments leased; portal enquiries up 40% this month.',-5,'Directors'),
    ('Monsoon Sales Campaign','Milestone','Offer structure approved by the board.',-12,'Directors'),
    ('Monsoon Sales Campaign','Progress','Landing page live in staging; ads go live after partner briefing.',-2,'Sales Head'),
    ('Heritage Court Redevelopment','Issue','Project put on hold: municipal approval stalled, developer agreement cancelled.',-25,'Directors'),
    ('Hinjewadi Parcel Title Cleanup','Progress','Mutation entries filed for 9 of 14 survey numbers.',-7,'Legal Head'),
    ('Hinjewadi Parcel Title Cleanup','Issue','Boundary dispute with neighbouring owner needs a hearing date.',-3,'Directors')
  ) as x(proj, type, descr, d, sent)
  join public.projects p on p.project_name = x.proj;

  -- project users
  insert into public.project_users (project_id, user_email, full_name, sort_order)
  select p.id, x.email, x.fname, x.ord
  from public.projects p
  join (values
    ('Palm Grove Plotting','karan.verma@seloraos.online','Karan Verma',0),
    ('Palm Grove Plotting','rohan.mehta@seloraos.online','Rohan Mehta',1),
    ('Skyline Mall Fit-out','rohan.mehta@seloraos.online','Rohan Mehta',0),
    ('Skyline Mall Fit-out','priya.nair@seloraos.online','Priya Nair',1),
    ('Riverside Rentals Drive','sneha.iyer@seloraos.online','Sneha Iyer',0),
    ('Monsoon Sales Campaign','sneha.iyer@seloraos.online','Sneha Iyer',0),
    ('Monsoon Sales Campaign','aarav.shah@seloraos.online','Aarav Shah',1),
    ('Hinjewadi Parcel Title Cleanup','vikram.rao@seloraos.online','Vikram Rao',0),
    ('Hinjewadi Parcel Title Cleanup','neha.kapoor@seloraos.online','Neha Kapoor',1)
  ) as x(proj, email, fname, ord) on x.proj = p.project_name
  where p.project_name = any(names);

  -- final statuses
  update public.projects set status = 'Cancelled', actual_end_date = current_date - 20 where project_name = 'Heritage Court Redevelopment';
  update public.projects set status = 'Open' where project_name = any(names) and project_name <> 'Heritage Court Redevelopment';
end $$;
