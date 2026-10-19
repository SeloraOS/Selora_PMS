-- Phase 2, part 3: snags (quality issues) and approvals / compliance tracker.

create table if not exists public.snags (
  id           uuid primary key default gen_random_uuid(),
  code         text unique,
  project_id   uuid not null references public.projects(id) on delete cascade,
  title        text not null check (length(btrim(title)) > 0),
  description  text,
  location     text,
  category     text references public.snag_categories(name) on update cascade on delete set null,
  severity     text not null default 'Medium' check (severity in ('Low','Medium','High','Critical')),
  status       text not null default 'Open' check (status in ('Open','Fixed','Verified','Rejected')),
  task_id      uuid references public.project_tasks(id) on delete set null,
  assignee_id  uuid references public.profiles(id) on delete set null,
  due_date     date,
  visibility   text not null default 'internal' check (visibility in ('internal','shared')),
  reported_by  uuid default auth.uid() references auth.users(id) on delete set null,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_snags_project  on public.snags(project_id, status);
create index if not exists idx_snags_assignee on public.snags(assignee_id);
create index if not exists idx_snags_task     on public.snags(task_id);
create index if not exists idx_snags_reporter on public.snags(reported_by);
create index if not exists idx_snags_category on public.snags(category);

drop trigger if exists trg_snags_updated on public.snags;
create trigger trg_snags_updated before update on public.snags for each row execute function public.set_updated_at();
drop trigger if exists trg_snags_code on public.snags;
create trigger trg_snags_code before insert on public.snags for each row execute function public.assign_doc_code('SNAG');
drop trigger if exists trg_snags_code_immutable on public.snags;
create trigger trg_snags_code_immutable before update on public.snags for each row execute function public.forbid_code_change();

-- defaults and role rules: due date from settings; external reporters always create shared, open snags;
-- contractors can only move their snags between Open and Fixed; closing stamps closed_at
create or replace function public.snag_rules()
returns trigger language plpgsql security definer set search_path = public as $$
declare role public.app_role := public.current_app_role();
begin
  if tg_op = 'INSERT' then
    if new.due_date is null then
      new.due_date := current_date + coalesce((select snag_default_due_days from public.pm_settings limit 1), 7);
    end if;
    if role in ('client','contractor') then
      new.visibility := 'shared'; new.status := 'Open'; new.assignee_id := null; new.reported_by := auth.uid();
    end if;
  else
    if role = 'contractor' then
      if (to_jsonb(new) - array['status','updated_at','closed_at']) is distinct from (to_jsonb(old) - array['status','updated_at','closed_at']) then
        raise exception 'Contractors can only change the status of their snags' using errcode = '42501';
      end if;
      if new.status not in ('Open','Fixed') then
        raise exception 'Contractors can mark a snag Fixed; staff verify it' using errcode = '42501';
      end if;
    end if;
    if new.status in ('Verified','Rejected') and old.status not in ('Verified','Rejected') then new.closed_at := now();
    elsif new.status in ('Open','Fixed') then new.closed_at := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_snags_rules on public.snags;
create trigger trg_snags_rules before insert or update on public.snags for each row execute function public.snag_rules();

create table if not exists public.approvals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null check (length(btrim(name)) > 0),
  authority     text,
  reference_no  text,
  applied_on    date,
  approved_on   date,
  expiry_on     date,
  status        text not null default 'Not started' check (status in ('Not started','Applied','Approved','Rejected')),
  notes         text,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, name),
  check (approved_on is null or applied_on is null or approved_on >= applied_on),
  check (expiry_on is null or approved_on is null or expiry_on >= approved_on)
);
create index if not exists idx_approvals_project on public.approvals(project_id);
create index if not exists idx_approvals_expiry  on public.approvals(expiry_on);
create index if not exists idx_approvals_creator on public.approvals(created_by);
drop trigger if exists trg_approvals_updated on public.approvals;
create trigger trg_approvals_updated before update on public.approvals for each row execute function public.set_updated_at();

-- standard approvals for a residential/commercial development
create or replace function public.add_standard_approvals(p_project uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_internal() or not public.can_access_project(p_project) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.approvals (project_id, name, authority)
  select p_project, x.name, x.authority from (values
    ('RERA registration', 'State RERA authority'),
    ('Commencement certificate', 'Municipal corporation'),
    ('Environmental clearance', 'State environment impact assessment authority'),
    ('Fire NOC', 'Fire department'),
    ('Height / airport clearance', 'AAI'),
    ('Water and sewer connection approval', 'Water board'),
    ('Occupancy certificate', 'Municipal corporation')
  ) as x(name, authority)
  on conflict (project_id, name) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.add_standard_approvals(uuid) from public, anon;
grant execute on function public.add_standard_approvals(uuid) to authenticated;
