-- Shared helpers for the pgTAP suite. Files run in alphabetical order; this one commits so the
-- helpers exist for the rest. They live in the `tests` schema, never exposed through the API.
begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(email text, full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (
    user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
    '{"provider": "google"}', jsonb_build_object('full_name', full_name)
  );
  return user_id;
end;
$$;

-- Acts as `user_id` for the rest of the transaction, like a request carrying its JWT.
create or replace function tests.authenticate_as(user_id uuid, app_role text default null)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', user_id,
    'role', 'authenticated',
    'app_metadata', case when app_role is null then '{}'::jsonb else jsonb_build_object('role', app_role) end
  )::text, true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_function('tests', 'authenticate_as', array['uuid', 'text']);
select * from finish();
commit;
