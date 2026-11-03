-- Shared catalog (docs/PLAN.md F3): read-only for users, written only by server processes.
-- User contributions enter as status = 'pending' and become visible to everyone once verified.

-- Connector types -------------------------------------------------------------

create table public.connector_types (
  id smallint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9_]+$'),
  name text not null,
  current public.current_type not null,
  max_kw_typical numeric(6, 1) check (max_kw_typical > 0),
  ocm_id integer unique,
  compatible_adapters text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.connector_types.ocm_id is 'ConnectionType id in Open Charge Map.';
comment on column public.connector_types.compatible_adapters is 'Connector codes reachable with a common adapter.';

-- Brands and models -----------------------------------------------------------

create table public.ev_brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  country char(2) check (country ~ '^[A-Z]{2}$'),
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ev_brands_name_trgm on public.ev_brands using gin (lower(name) extensions.gin_trgm_ops);

create table public.ev_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.ev_brands (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  body_type text,
  markets text[] not null default '{}',
  aliases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create index ev_models_name_trgm on public.ev_models using gin (lower(name) extensions.gin_trgm_ops);
create index ev_models_aliases on public.ev_models using gin (aliases);

-- Variants: technical sheet per year and trim -----------------------------------

create table public.ev_variants (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.ev_models (id) on delete cascade,
  year_from smallint not null check (year_from between 1990 and 2100),
  year_to smallint check (year_to between 1990 and 2100),
  trim text not null default '',
  battery_gross_kwh numeric(6, 2) check (battery_gross_kwh > 0),
  battery_usable_kwh numeric(6, 2) check (battery_usable_kwh > 0),
  chemistry text,
  range_km numeric(6, 1) check (range_km > 0),
  range_cycle public.range_cycle,
  consumption_kwh_100km numeric(5, 2) check (consumption_kwh_100km > 0),
  curb_weight_kg numeric(6, 1) check (curb_weight_kg > 0),
  ac_onboard_kw numeric(5, 2) check (ac_onboard_kw > 0),
  ac_phases smallint check (ac_phases in (1, 3)),
  dc_max_kw numeric(6, 1) check (dc_max_kw > 0),
  connector_ac_id smallint references public.connector_types (id),
  connector_dc_id smallint references public.connector_types (id),
  charge_curve jsonb check (public.is_valid_charge_curve(charge_curve)),
  field_sources jsonb not null default '{}' check (jsonb_typeof(field_sources) = 'object'),
  status public.catalog_status not null default 'pending',
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_to is null or year_to >= year_from),
  check (battery_usable_kwh is null or battery_gross_kwh is null or battery_usable_kwh <= battery_gross_kwh),
  check (range_km is null or range_cycle is not null)
);

comment on column public.ev_variants.field_sources is
  'Per-field provenance: {"<column>": {"source", "source_url", "retrieved_at", "confidence"}}.';

create index ev_variants_model on public.ev_variants (model_id);
create index ev_variants_submitted_by on public.ev_variants (submitted_by) where submitted_by is not null;

-- Charger models (wallbox and portable) ----------------------------------------

create table public.charger_models (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(brand) between 1 and 80),
  model text not null check (length(model) between 1 and 120),
  kind public.charger_kind not null,
  rated_kw numeric(5, 2) not null check (rated_kw > 0),
  phases smallint not null default 1 check (phases in (1, 3)),
  max_amperage_a numeric(5, 1) check (max_amperage_a between 1 and 500),
  adjustable_amperage numeric(5, 1)[] not null default '{}',
  input_voltage_min numeric(5, 1) check (input_voltage_min between 100 and 1000),
  input_voltage_max numeric(5, 1) check (input_voltage_max between 100 and 1000),
  connector_type_id smallint references public.connector_types (id),
  tethered_cable boolean not null default true,
  field_sources jsonb not null default '{}' check (jsonb_typeof(field_sources) = 'object'),
  status public.catalog_status not null default 'pending',
  submitted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (input_voltage_max is null or input_voltage_min is null or input_voltage_max >= input_voltage_min)
);

create index charger_models_search_trgm on public.charger_models
  using gin (lower(brand || ' ' || model) extensions.gin_trgm_ops);
create index charger_models_submitted_by on public.charger_models (submitted_by) where submitted_by is not null;

-- Submissions and AI lookups of missing models ---------------------------------

create table public.catalog_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.catalog_kind not null,
  query text not null check (length(query) between 2 and 200),
  extracted jsonb check (extracted is null or jsonb_typeof(extracted) = 'object'),
  sources jsonb not null default '[]' check (jsonb_typeof(sources) = 'array'),
  status public.submission_status not null default 'pending',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_variant_id uuid references public.ev_variants (id) on delete set null,
  created_charger_model_id uuid references public.charger_models (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending') = (reviewed_at is null))
);

create index catalog_submissions_user on public.catalog_submissions (user_id, created_at desc);
create index catalog_submissions_pending on public.catalog_submissions (created_at) where status = 'pending';

-- Import log (no client access) ------------------------------------------------

create table public.catalog_sync_runs (
  id bigint generated always as identity primary key,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  inserted integer not null default 0 check (inserted >= 0),
  updated integer not null default 0 check (updated >= 0),
  skipped_verified integer not null default 0 check (skipped_verified >= 0),
  errors jsonb not null default '[]' check (jsonb_typeof(errors) = 'array')
);

-- updated_at triggers ----------------------------------------------------------

create trigger set_updated_at before update on public.connector_types
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ev_brands
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ev_models
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.ev_variants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.charger_models
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.catalog_submissions
  for each row execute function public.set_updated_at();

-- Row level security ------------------------------------------------------------

alter table public.connector_types enable row level security;
alter table public.ev_brands enable row level security;
alter table public.ev_models enable row level security;
alter table public.ev_variants enable row level security;
alter table public.charger_models enable row level security;
alter table public.catalog_submissions enable row level security;
alter table public.catalog_sync_runs enable row level security;

-- Catalog writes happen only through the service role (importers, admin review).
revoke insert, update, delete, truncate on
  public.connector_types, public.ev_brands, public.ev_models, public.ev_variants, public.charger_models
  from anon, authenticated;
revoke all on public.catalog_sync_runs from anon, authenticated;

create policy "connector types are public"
  on public.connector_types for select to anon, authenticated
  using (true);

create policy "authenticated users read brands"
  on public.ev_brands for select to authenticated
  using (true);

create policy "authenticated users read models"
  on public.ev_models for select to authenticated
  using (true);

create policy "users read verified variants and their own contributions"
  on public.ev_variants for select to authenticated
  using (status = 'verified' or submitted_by = (select auth.uid()) or (select public.is_admin()));

create policy "users read verified chargers and their own contributions"
  on public.charger_models for select to authenticated
  using (status = 'verified' or submitted_by = (select auth.uid()) or (select public.is_admin()));

create policy "users read their own submissions"
  on public.catalog_submissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "users create pending submissions"
  on public.catalog_submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and created_variant_id is null
    and created_charger_model_id is null
  );

create policy "admins review submissions"
  on public.catalog_submissions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "users delete their own pending submissions"
  on public.catalog_submissions for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
