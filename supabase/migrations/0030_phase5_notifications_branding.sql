-- Phase 5: notification settings + log, branding for generated documents, calendar feed token.
-- Secrets (SMTP password, WhatsApp token) are NOT stored here; they are Edge Function environment variables.

alter table public.pm_settings
  add column if not exists email_from            text    not null default '',
  add column if not exists notify_channels       text    not null default 'inapp' check (notify_channels ~ '^(inapp|email|whatsapp)(,(inapp|email|whatsapp))*$'),
  add column if not exists notify_roles          text    not null default 'admin,manager' check (notify_roles ~ '^(admin|manager|member)(,(admin|manager|member))*$'),
  add column if not exists digest_time           time    not null default '08:00',
  add column if not exists notify_overdue_tasks  boolean not null default true,
  add column if not exists notify_approvals      boolean not null default true,
  add column if not exists notify_bills          boolean not null default true,
  add column if not exists notify_dpr            boolean not null default true,
  add column if not exists notify_dry_run        boolean not null default true,
  add column if not exists whatsapp_enabled      boolean not null default false,
  add column if not exists whatsapp_numbers      text    not null default '',
  add column if not exists company_logo          text    check (company_logo is null or (company_logo like 'data:image/%' and length(company_logo) <= 400000)),
  add column if not exists letterhead            text    not null default '' check (length(letterhead) <= 2000),
  add column if not exists ics_token             text    not null default replace(gen_random_uuid()::text, '-', '');

create table if not exists public.notification_log (
  id         uuid primary key default gen_random_uuid(),
  sent_on    date not null default current_date,
  channel    text not null check (channel in ('email','whatsapp')),
  recipient  text not null,
  subject    text,
  body       text,
  status     text not null check (status in ('sent','failed','dry_run','skipped')),
  error      text,
  created_at timestamptz not null default now()
);
create index if not exists idx_notification_log_day on public.notification_log(sent_on desc, channel);
-- one real delivery per recipient, channel and day
create unique index if not exists uq_notification_sent on public.notification_log(sent_on, channel, recipient) where status = 'sent';

alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon;
grant select on public.notification_log to authenticated;
drop policy if exists notification_log_read on public.notification_log;
create policy notification_log_read on public.notification_log for select to authenticated using (public.is_staff());
-- rows are written by the notify function with the service role only

-- a fresh calendar-feed link (old links stop working)
create or replace function public.rotate_ics_token()
returns text language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_staff() then raise exception 'Only admins and managers can do this' using errcode = '42501'; end if;
  update public.pm_settings set ics_token = t where id = true;
  return t;
end $$;
revoke all on function public.rotate_ics_token() from public, anon;
grant execute on function public.rotate_ics_token() to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notification_log') then
    alter publication supabase_realtime add table public.notification_log;
  end if;
end $$;
