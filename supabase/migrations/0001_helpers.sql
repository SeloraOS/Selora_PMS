-- Helpers: updated_at trigger and atomic document-code counters (PROJ-0001, TASK-0001, TS-0001)

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table if not exists public.doc_counters (
  prefix     text primary key,
  last_value integer not null default 0
);

create or replace function public.next_doc_code(p_prefix text, p_width int default 4)
returns text language plpgsql security definer set search_path = public as $$
declare
  v integer;
begin
  insert into public.doc_counters (prefix, last_value)
  values (p_prefix, 1)
  on conflict (prefix) do update set last_value = public.doc_counters.last_value + 1
  returning last_value into v;
  return p_prefix || '-' || lpad(v::text, p_width, '0');
end $$;

-- Generic before-insert trigger: fills NEW.code from the prefix passed as trigger argument
create or replace function public.assign_doc_code()
returns trigger language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := public.next_doc_code(tg_argv[0], 4);
  end if;
  return new;
end $$;
