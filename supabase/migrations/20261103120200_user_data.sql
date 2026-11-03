-- Per-user data. Every row belongs to one auth user; RLS restricts each operation to its owner.
-- Foreign keys to another user-owned row (e.g. vehicle_id) are also checked in the policies,
-- because a plain FK would let a user reference somebody else's vehicle.

-- Profiles --------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 120),
  avatar_url text check (length(avatar_url) <= 2048),
  units public.unit_system not null default 'metric',
  currency char(3) not null default 'COP' check (currency ~ '^[A-Z]{3}$'),
  -- Entered by the user from their energy provider's bill; no default tariff.
  tariff_per_kwh numeric(10, 2) check (tariff_per_kwh >= 0),
  reserve_pct smallint not null default 10 check (reserve_pct between 0 and 50),
  default_vehicle_id uuid,
  default_charger_id uuid,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garage ------------------------------------------------------------------------

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  variant_id uuid references public.ev_variants (id) on delete restrict,
  nickname text not null check (length(nickname) between 1 and 60),
  overrides jsonb not null default '{}' check (jsonb_typeof(overrides) = 'object'),
  battery_health_pct numeric(4, 1) not null default 100 check (battery_health_pct between 50 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.vehicles.overrides is
  'Spec values corrected by the owner; they never modify the shared catalog.';

create index vehicles_owner on public.vehicles (owner_id, created_at desc);

create table public.chargers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  charger_model_id uuid references public.charger_models (id) on delete restrict,
  name text not null check (length(name) between 1 and 60),
  use public.charger_use not null default 'home',
  voltage_v numeric(5, 1) not null check (voltage_v between 100 and 1000),
  phases smallint not null default 1 check (phases in (1, 3)),
  circuit_amperage_a numeric(5, 1) not null check (circuit_amperage_a between 1 and 500),
  connector_type_id smallint references public.connector_types (id),
  efficiency numeric(3, 2) check (efficiency > 0 and efficiency <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chargers_owner on public.chargers (owner_id, created_at desc);

alter table public.profiles
  add constraint profiles_default_vehicle_fk
    foreign key (default_vehicle_id) references public.vehicles (id) on delete set null,
  add constraint profiles_default_charger_fk
    foreign key (default_charger_id) references public.chargers (id) on delete set null;

-- Calculation history -------------------------------------------------------------

create table public.trip_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  origin_lat double precision not null check (origin_lat between -90 and 90),
  origin_lng double precision not null check (origin_lng between -180 and 180),
  origin_label text check (length(origin_label) <= 300),
  dest_lat double precision not null check (dest_lat between -90 and 90),
  dest_lng double precision not null check (dest_lng between -180 and 180),
  dest_label text check (length(dest_label) <= 300),
  distance_km numeric(8, 2) not null check (distance_km >= 0),
  duration_min numeric(8, 1) not null check (duration_min >= 0),
  ascent_m numeric(8, 1) not null default 0 check (ascent_m >= 0),
  descent_m numeric(8, 1) not null default 0 check (descent_m >= 0),
  -- Null when the user disables storing full routes (privacy setting).
  route_polyline text,
  start_soc numeric(5, 2) not null check (start_soc between 0 and 100),
  energy_kwh numeric(8, 3) not null,
  consumed_pct numeric(6, 2) not null,
  -- Can be negative: the trip is not reachable with the current charge.
  arrival_soc numeric(6, 2) not null check (arrival_soc between -1000 and 100),
  inputs jsonb not null default '{}' check (jsonb_typeof(inputs) = 'object'),
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trip_calculations_user on public.trip_calculations (user_id, created_at desc);

create table public.charge_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  charger_id uuid references public.chargers (id) on delete set null,
  start_soc numeric(5, 2) not null check (start_soc between 0 and 100),
  target_soc numeric(5, 2) not null check (target_soc between 0 and 100),
  effective_kw numeric(6, 2) not null check (effective_kw > 0),
  energy_grid_kwh numeric(8, 3) not null check (energy_grid_kwh >= 0),
  duration_min numeric(8, 1) not null check (duration_min >= 0),
  cost numeric(12, 2) check (cost >= 0),
  inputs jsonb not null default '{}' check (jsonb_typeof(inputs) = 'object'),
  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_soc > start_soc)
);

create index charge_calculations_user on public.charge_calculations (user_id, created_at desc);

-- Real charging sessions (phase 6) -----------------------------------------------

create table public.charging_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  charger_id uuid references public.chargers (id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  start_soc numeric(5, 2) check (start_soc between 0 and 100),
  end_soc numeric(5, 2) check (end_soc between 0 and 100),
  energy_kwh numeric(8, 3) check (energy_kwh >= 0),
  cost numeric(12, 2) check (cost >= 0),
  odometer_km numeric(9, 1) check (odometer_km >= 0),
  location_label text check (length(location_label) <= 300),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (end_soc is null or start_soc is null or end_soc > start_soc)
);

create index charging_sessions_user on public.charging_sessions (user_id, started_at desc);

-- Audit log ---------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (event in ('sign_in', 'sign_out', 'account_export', 'account_delete')),
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_log_user on public.audit_log (user_id, created_at desc);

-- The only way for a client to write the audit log; always attributed to the caller.
create function public.log_audit_event(event text, metadata jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.audit_log (user_id, event, metadata)
  values (auth.uid(), log_audit_event.event, coalesce(log_audit_event.metadata, '{}'));
end;
$$;

revoke all on function public.log_audit_event(text, jsonb) from public, anon;
grant execute on function public.log_audit_event(text, jsonb) to authenticated;

-- New users -----------------------------------------------------------------------

-- Creates the profile from the Google identity on first sign-in.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120),
    left(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), 2048)
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at triggers -------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.chargers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.trip_calculations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.charge_calculations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.charging_sessions
  for each row execute function public.set_updated_at();

-- Ownership helpers for policies ------------------------------------------------------
-- security invoker on purpose: they see only rows the caller can already see under RLS.

create function public.owns_vehicle(vehicle uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select vehicle is null or exists (
    select 1 from public.vehicles v where v.id = vehicle and v.owner_id = (select auth.uid())
  );
$$;

create function public.owns_charger(charger uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select charger is null or exists (
    select 1 from public.chargers c where c.id = charger and c.owner_id = (select auth.uid())
  );
$$;

-- Row level security ----------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.chargers enable row level security;
alter table public.trip_calculations enable row level security;
alter table public.charge_calculations enable row level security;
alter table public.charging_sessions enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
revoke all on
  public.profiles, public.vehicles, public.chargers,
  public.trip_calculations, public.charge_calculations, public.charging_sessions
  from anon;
-- Profiles are created by handle_new_user and deleted with the auth user.
revoke insert, delete on public.profiles from authenticated;

create policy "owner reads profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "owner updates profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and public.owns_vehicle(default_vehicle_id)
    and public.owns_charger(default_charger_id)
  );

create policy "owner reads vehicles" on public.vehicles
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates vehicles" on public.vehicles
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates vehicles" on public.vehicles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "owner deletes vehicles" on public.vehicles
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner reads chargers" on public.chargers
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates chargers" on public.chargers
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates chargers" on public.chargers
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "owner deletes chargers" on public.chargers
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "owner reads trips" on public.trip_calculations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates trips" on public.trip_calculations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.owns_vehicle(vehicle_id));
create policy "owner updates trips" on public.trip_calculations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.owns_vehicle(vehicle_id));
create policy "owner deletes trips" on public.trip_calculations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "owner reads charge calculations" on public.charge_calculations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates charge calculations" on public.charge_calculations
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_vehicle(vehicle_id)
    and public.owns_charger(charger_id)
  );
create policy "owner updates charge calculations" on public.charge_calculations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_vehicle(vehicle_id)
    and public.owns_charger(charger_id)
  );
create policy "owner deletes charge calculations" on public.charge_calculations
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "owner reads charging sessions" on public.charging_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates charging sessions" on public.charging_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.owns_vehicle(vehicle_id)
    and public.owns_charger(charger_id)
  );
create policy "owner updates charging sessions" on public.charging_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.owns_vehicle(vehicle_id)
    and public.owns_charger(charger_id)
  );
create policy "owner deletes charging sessions" on public.charging_sessions
  for delete to authenticated using (user_id = (select auth.uid()));
