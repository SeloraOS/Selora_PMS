-- Phase 1, part 3: attachments (+ storage bucket), comments, audit log.

-- ── attachments ───────────────────────────────────────────────────────────────
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  record_type   text not null,
  record_id     uuid not null,
  storage_path  text not null unique,
  name          text not null,
  mime          text,
  size_bytes    bigint not null check (size_bytes >= 0),
  visibility    text not null default 'internal' check (visibility in ('internal','shared')),
  uploaded_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_attachments_project  on public.attachments(project_id);
create index if not exists idx_attachments_record   on public.attachments(record_type, record_id);
create index if not exists idx_attachments_uploader on public.attachments(uploaded_by);

create or replace function public.check_attachment()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record; ext text;
begin
  select max_upload_mb, allowed_file_types into s from public.pm_settings limit 1;
  if new.size_bytes > coalesce(s.max_upload_mb, 25)::bigint * 1024 * 1024 then
    raise exception 'File is larger than the % MB upload limit', s.max_upload_mb using errcode = '23514';
  end if;
  ext := lower(substring(new.name from '\.([^.]+)$'));
  if ext is null or not (ext = any (string_to_array(lower(replace(coalesce(s.allowed_file_types, ''), ' ', '')), ','))) then
    raise exception 'File type ".%" is not allowed (allowed: %)', coalesce(ext, '?'), s.allowed_file_types using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_attachments_check on public.attachments;
create trigger trg_attachments_check before insert on public.attachments
  for each row execute function public.check_attachment();

-- ── comments ─────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  record_type  text not null,
  record_id    uuid not null,
  body         text not null check (length(btrim(body)) > 0 and length(body) <= 4000),
  visibility   text not null default 'internal' check (visibility in ('internal','shared')),
  author       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);
create index if not exists idx_comments_project on public.comments(project_id);
create index if not exists idx_comments_record  on public.comments(record_type, record_id, created_at);
create index if not exists idx_comments_author  on public.comments(author);

-- ── audit log ────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,
  table_name  text not null,
  record_id   uuid,
  project_id  uuid,
  action      text not null check (action in ('insert','update','delete')),
  changes     jsonb
);
create index if not exists idx_audit_project on public.audit_log(project_id, at desc);
create index if not exists idx_audit_record  on public.audit_log(table_name, record_id, at desc);
create index if not exists idx_audit_at      on public.audit_log(at);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb; rid uuid; pid uuid; ch jsonb;
  noise text[] := array['updated_at','total_working_hours','total_billable_hours','total_billable_amount','total_costing_amount'];
begin
  r := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rid := case when tg_table_name = 'pm_settings' then null else nullif(r->>'id','')::uuid end;
  pid := case when tg_table_name = 'projects' then rid else nullif(r->>'project_id','')::uuid end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)) into ch
      from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value and n.key <> all (noise);
    if ch is null then return new; end if;
  else
    ch := r;
  end if;
  insert into public.audit_log (actor, table_name, record_id, project_id, action, changes)
  values (auth.uid(), tg_table_name, rid, pid, lower(tg_op), ch);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','project_tasks','timesheets','project_updates','project_users','pm_settings','profiles','attachments'] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit after insert or update or delete on public.%1$s
                    for each row execute function public.audit_row()', t);
  end loop;
end $$;

create or replace function public.purge_audit_log()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.audit_log where at < now() - make_interval(days => (select audit_retention_days from public.pm_settings limit 1));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.purge_audit_log() from public, anon, authenticated;

-- ── storage bucket (private) ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 209715200)
on conflict (id) do nothing;

-- folder convention: <project_id>/<uuid>-<file name>
create or replace function public.storage_project(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return (split_part(object_name, '/', 1))::uuid;
exception when others then
  return null;
end $$;
