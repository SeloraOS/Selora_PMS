-- Reference data (idempotent). Safe to re-run.
insert into public.project_types (name, description) values
  ('Residential Development', 'Apartments, villas and townhouse projects'),
  ('Commercial Development',  'Offices, retail and mixed-use projects'),
  ('Sales & Marketing',       'Launches, campaigns and channel partner programs'),
  ('Property Management',     'Handover, maintenance and leasing operations'),
  ('Compliance & Legal',      'RERA, approvals, title and documentation')
on conflict (name) do nothing;

insert into public.activity_types (name, costing_rate, billing_rate) values
  ('Site Visit',           600, 1200),
  ('Client Meeting',       500, 1000),
  ('Legal & Documentation',900, 1800),
  ('Marketing',            500,  900),
  ('Architecture & Design',800, 1500),
  ('Site Supervision',     700, 1300),
  ('Sales Follow-up',      400,  800),
  ('Property Inspection',  600, 1100)
on conflict (name) do nothing;

-- Holiday lists (lists are created by migration 0013)
insert into public.holidays (list_id, holiday_date, description)
select l.id, h.d::date, h.descr
from (values
  ('Standard Corporate','2026-01-26','Republic Day'),
  ('Standard Corporate','2026-05-01','Maharashtra Day'),
  ('Standard Corporate','2026-08-15','Independence Day'),
  ('Standard Corporate','2026-10-02','Gandhi Jayanti'),
  ('Standard Corporate','2026-10-20','Dussehra'),
  ('Standard Corporate','2026-11-08','Diwali'),
  ('Standard Corporate','2026-12-25','Christmas'),
  ('Factory Shift','2026-01-26','Republic Day'),
  ('Factory Shift','2026-08-15','Independence Day'),
  ('Factory Shift','2026-10-02','Gandhi Jayanti'),
  ('Factory Shift','2026-12-25','Christmas')
) as h(list, d, descr)
join public.holiday_lists l on l.name = h.list
on conflict (list_id, holiday_date) do nothing;
