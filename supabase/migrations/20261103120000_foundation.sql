-- Foundation: extensions, enums and helper functions shared by every table.

create extension if not exists pg_trgm with schema extensions;

-- Enums -----------------------------------------------------------------------

create type public.range_cycle as enum ('NEDC', 'WLTP', 'EPA', 'CLTC');
create type public.catalog_status as enum ('pending', 'verified');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.catalog_kind as enum ('vehicle', 'charger');
create type public.current_type as enum ('AC', 'DC');
create type public.charger_kind as enum ('wallbox', 'portable');
create type public.charger_use as enum ('home', 'public');
create type public.unit_system as enum ('metric', 'imperial');

-- Helpers ---------------------------------------------------------------------

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Administrators carry app_metadata.role = 'admin' in their JWT. app_metadata can only
-- be written with the service role, so users cannot grant it to themselves.
create function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- A charge curve is a non-empty array of {"soc": 0..100, "kw": > 0} points.
create function public.is_valid_charge_curve(curve jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select curve is null or (
    jsonb_typeof(curve) = 'array'
    and jsonb_array_length(curve) > 0
    and not exists (
      select 1
      from jsonb_array_elements(curve) as point
      where case
        when jsonb_typeof(point) <> 'object' then true
        when jsonb_typeof(point -> 'soc') is distinct from 'number' then true
        when jsonb_typeof(point -> 'kw') is distinct from 'number' then true
        else (point ->> 'soc')::numeric not between 0 and 100
          or (point ->> 'kw')::numeric <= 0
      end
    )
  );
$$;
