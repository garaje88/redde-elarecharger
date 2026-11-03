begin;
select plan(5);

select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every public table has RLS enabled'
);

select is_empty(
  $$ select c.relname
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
       and c.relname not in ('catalog_sync_runs', 'audit_log') $$,
  'every client-facing table has at least one policy'
);

select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and qual = 'true'
       and tablename not in ('connector_types', 'ev_brands', 'ev_models') $$,
  'only reference catalog tables use using (true)'
);

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  'security definer functions pin search_path'
);

select is(
  (select count(*)::int from public.connector_types),
  8,
  'reference connector types are loaded'
);

select * from finish();
rollback;
