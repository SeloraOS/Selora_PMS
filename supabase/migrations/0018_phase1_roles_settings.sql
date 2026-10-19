-- Phase 1 (trust foundation), part 1: external account types and the settings the access model needs.
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as its first use, so this file only adds values.
alter type public.app_role add value if not exists 'client';
alter type public.app_role add value if not exists 'contractor';

alter table public.pm_settings
  add column if not exists members_see_all      boolean not null default true,
  add column if not exists max_upload_mb        integer not null default 25 check (max_upload_mb between 1 and 200),
  add column if not exists allowed_file_types   text    not null default 'pdf,png,jpg,jpeg,webp,doc,docx,xls,xlsx,csv,dwg,zip',
  add column if not exists default_project_role text    not null default 'viewer' check (default_project_role in ('owner','staff','contractor','client','viewer')),
  add column if not exists client_can_comment   boolean not null default true,
  add column if not exists audit_retention_days integer not null default 365 check (audit_retention_days between 30 and 3650),
  add column if not exists invite_only          boolean not null default true;
