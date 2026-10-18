-- Lets scripts/verify-db.mjs compare field mappings with the real columns
-- (the API gateway blocks the PostgREST OpenAPI document).
create or replace function public.verify_columns()
returns table (table_name text, column_name text)
language sql stable security invoker set search_path = public as $$
  select c.table_name::text, c.column_name::text
    from information_schema.columns c
   where c.table_schema = 'public'
   order by 1, c.ordinal_position;
$$;
revoke all on function public.verify_columns() from public, anon;
grant execute on function public.verify_columns() to authenticated;
