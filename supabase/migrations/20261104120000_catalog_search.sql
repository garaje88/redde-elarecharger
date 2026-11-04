-- Phase 3: typo-tolerant catalog search (pg_trgm), importer bookkeeping, generic home chargers
-- and confirmation of AI lookups into pending catalog entries.

-- Normalized search text -------------------------------------------------------
-- "Deepal S-05", "deepal s05" and "DEEPAL  S05" all normalize to "deepal s05".

create function public.catalog_normalize(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(regexp_replace(
    regexp_replace(lower(coalesce(value, '')), '([a-z])[-_.]([0-9])', '\1\2', 'g'),
    '[^a-z0-9áéíóúñü]+', ' ', 'g'
  ));
$$;

alter table public.ev_models add column search_text text not null default '';

create function public.ev_models_set_search_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_text := public.catalog_normalize(concat_ws(' ',
    (select b.name from public.ev_brands b where b.id = new.brand_id),
    new.name,
    array_to_string(new.aliases, ' ')
  ));
  return new;
end;
$$;

create trigger set_search_text before insert or update of brand_id, name, aliases on public.ev_models
  for each row execute function public.ev_models_set_search_text();

-- Renaming a brand refreshes the search text of its models.
create function public.ev_brands_refresh_model_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.ev_models set name = name where brand_id = new.id;
  return null;
end;
$$;

create trigger refresh_model_search after update of name on public.ev_brands
  for each row execute function public.ev_brands_refresh_model_search();

update public.ev_models set name = name;

create index ev_models_search_trgm on public.ev_models
  using gin (search_text extensions.gin_trgm_ops);

alter table public.charger_models add column search_text text
  generated always as (public.catalog_normalize(brand || ' ' || model)) stored;

drop index public.charger_models_search_trgm;
create index charger_models_search_trgm on public.charger_models
  using gin (search_text extensions.gin_trgm_ops);

-- Importer keys: one row per record of each source, so reimports update instead of duplicating.

alter table public.ev_variants add column source_ref text unique
  check (source_ref ~ '^[a-z0-9-]+:.+$');
comment on column public.ev_variants.source_ref is
  'Importer key "<source>:<external id>"; null for contributions and manual rows.';

alter table public.charger_models add column source_ref text unique
  check (source_ref ~ '^[a-z0-9-]+:.+$');

-- Search functions (security invoker: RLS decides which variants each caller sees) -----------

create function public.search_ev_brands(query text default '', max_rows integer default 30)
returns table (id uuid, name text, slug text, country char(2), model_count bigint)
language sql
stable
set search_path = ''
as $$
  with q as (select public.catalog_normalize(query) as text)
  select b.id, b.name, b.slug, b.country, count(distinct m.id) as model_count
  from public.ev_brands b
  join public.ev_models m on m.brand_id = b.id
  join public.ev_variants v on v.model_id = m.id
  cross join q
  where q.text = ''
     or public.catalog_normalize(b.name) like q.text || '%'
     or extensions.word_similarity(q.text, public.catalog_normalize(b.name)) >= 0.4
  group by b.id, q.text
  order by
    case when q.text = '' then 0
         else 1 - extensions.word_similarity(q.text, public.catalog_normalize(b.name)) end,
    b.name
  limit least(greatest(max_rows, 1), 100);
$$;

-- Rank: every query word present as a word wins, then trigram similarity (typos, "s-05").
create function public.catalog_match_score(query text, target text)
returns real
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when query = '' then 1
    else extensions.word_similarity(query, target)
      + case when (
          select bool_and(target ~ ('\m' || token || '\M'))
          from unnest(string_to_array(query, ' ')) as token
        ) then 1 else 0 end
  end::real;
$$;

create function public.search_ev_models(
  query text default '',
  brand uuid default null,
  max_rows integer default 30
)
returns table (
  id uuid,
  brand_id uuid,
  brand_name text,
  name text,
  slug text,
  body_type text,
  year_from smallint,
  year_to smallint,
  variant_count bigint,
  score real
)
language sql
stable
set search_path = ''
as $$
  with q as (select public.catalog_normalize(query) as text)
  select
    m.id, m.brand_id, b.name, m.name, m.slug, m.body_type,
    min(v.year_from), max(coalesce(v.year_to, v.year_from)),
    count(v.id),
    public.catalog_match_score(q.text, m.search_text)
  from public.ev_models m
  join public.ev_brands b on b.id = m.brand_id
  join public.ev_variants v on v.model_id = m.id
  cross join q
  where (brand is null or m.brand_id = brand)
    and (q.text = '' or extensions.word_similarity(q.text, m.search_text) >= 0.45)
  group by m.id, b.name, q.text
  order by 10 desc, b.name, m.name
  limit least(greatest(max_rows, 1), 100);
$$;

create function public.search_charger_models(query text default '', max_rows integer default 30)
returns setof public.charger_models
language sql
stable
set search_path = ''
as $$
  with q as (select public.catalog_normalize(query) as text)
  select c.*
  from public.charger_models c
  cross join q
  where q.text = '' or extensions.word_similarity(q.text, c.search_text) >= 0.45
  order by public.catalog_match_score(q.text, c.search_text) desc, c.kind, c.rated_kw, c.brand, c.model
  limit least(greatest(max_rows, 1), 100);
$$;

grant execute on function public.search_ev_brands(text, integer) to authenticated;
grant execute on function public.search_ev_models(text, uuid, integer) to authenticated;
grant execute on function public.search_charger_models(text, integer) to authenticated;
revoke execute on function public.search_ev_brands(text, integer) from anon, public;
revoke execute on function public.search_ev_models(text, uuid, integer) from anon, public;
revoke execute on function public.search_charger_models(text, integer) from anon, public;

-- Confirming an AI lookup -----------------------------------------------------------------
-- The user cannot write the catalog directly. Confirming one of their own pending submissions
-- creates a pending catalog row they alone can see until an admin verifies it. The server
-- validates `spec` with Zod first; the table CHECKs validate it again here.

create function public.confirm_vehicle_submission(submission uuid, spec jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sub public.catalog_submissions;
  brand_name text := nullif(trim(spec ->> 'brand'), '');
  model_name text := nullif(trim(spec ->> 'model'), '');
  brand_slug text;
  model_slug text;
  brand_id uuid;
  model_id uuid;
  variant_id uuid;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into sub from public.catalog_submissions
  where id = submission and user_id = caller and kind = 'vehicle'
  for update;

  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if sub.status <> 'pending' or sub.created_variant_id is not null then
    raise exception 'submission already confirmed' using errcode = '23505';
  end if;
  if brand_name is null or model_name is null then
    raise exception 'brand and model are required' using errcode = '23514';
  end if;

  brand_slug := trim(both '-' from regexp_replace(public.catalog_normalize(brand_name), '[^a-z0-9]+', '-', 'g'));
  model_slug := trim(both '-' from regexp_replace(public.catalog_normalize(model_name), '[^a-z0-9]+', '-', 'g'));
  if brand_slug = '' or model_slug = '' then
    raise exception 'brand and model need letters or digits' using errcode = '23514';
  end if;

  insert into public.ev_brands (name, slug) values (brand_name, brand_slug)
  on conflict (slug) do update set slug = excluded.slug
  returning id into brand_id;

  insert into public.ev_models (brand_id, name, slug) values (brand_id, model_name, model_slug)
  on conflict on constraint ev_models_brand_id_slug_key do update set slug = excluded.slug
  returning id into model_id;

  insert into public.ev_variants (
    model_id, year_from, year_to, trim, battery_gross_kwh, battery_usable_kwh, chemistry,
    range_km, range_cycle, consumption_kwh_100km, curb_weight_kg, ac_onboard_kw, ac_phases,
    dc_max_kw, connector_ac_id, connector_dc_id, field_sources, status, submitted_by
  ) values (
    model_id,
    (spec ->> 'year_from')::smallint,
    (spec ->> 'year_to')::smallint,
    coalesce(spec ->> 'trim', ''),
    (spec ->> 'battery_gross_kwh')::numeric,
    (spec ->> 'battery_usable_kwh')::numeric,
    spec ->> 'chemistry',
    (spec ->> 'range_km')::numeric,
    (spec ->> 'range_cycle')::public.range_cycle,
    (spec ->> 'consumption_kwh_100km')::numeric,
    (spec ->> 'curb_weight_kg')::numeric,
    (spec ->> 'ac_onboard_kw')::numeric,
    (spec ->> 'ac_phases')::smallint,
    (spec ->> 'dc_max_kw')::numeric,
    (select c.id from public.connector_types c where c.code = spec ->> 'connector_ac' and c.current = 'AC'),
    (select c.id from public.connector_types c where c.code = spec ->> 'connector_dc' and c.current = 'DC'),
    coalesce(spec -> 'field_sources', '{}'),
    'pending',
    caller
  )
  returning id into variant_id;

  update public.catalog_submissions
  set created_variant_id = variant_id
  where id = submission;

  return variant_id;
end;
$$;

create function public.confirm_charger_submission(submission uuid, spec jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  sub public.catalog_submissions;
  charger_id uuid;
begin
  if caller is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into sub from public.catalog_submissions
  where id = submission and user_id = caller and kind = 'charger'
  for update;

  if not found then
    raise exception 'submission not found' using errcode = 'P0002';
  end if;
  if sub.status <> 'pending' or sub.created_charger_model_id is not null then
    raise exception 'submission already confirmed' using errcode = '23505';
  end if;

  insert into public.charger_models (
    brand, model, kind, rated_kw, phases, max_amperage_a, adjustable_amperage,
    input_voltage_min, input_voltage_max, connector_type_id, tethered_cable,
    field_sources, status, submitted_by
  ) values (
    trim(spec ->> 'brand'),
    trim(spec ->> 'model'),
    (spec ->> 'kind')::public.charger_kind,
    (spec ->> 'rated_kw')::numeric,
    coalesce((spec ->> 'phases')::smallint, 1),
    (spec ->> 'max_amperage_a')::numeric,
    coalesce(
      (select array_agg(a::numeric) from jsonb_array_elements_text(spec -> 'adjustable_amperage') a),
      '{}'
    ),
    (spec ->> 'input_voltage_min')::numeric,
    (spec ->> 'input_voltage_max')::numeric,
    (select c.id from public.connector_types c where c.code = spec ->> 'connector'),
    coalesce((spec ->> 'tethered_cable')::boolean, true),
    coalesce(spec -> 'field_sources', '{}'),
    'pending',
    caller
  )
  returning id into charger_id;

  update public.catalog_submissions
  set created_charger_model_id = charger_id
  where id = submission;

  return charger_id;
end;
$$;

revoke execute on function public.confirm_vehicle_submission(uuid, jsonb) from anon, public;
revoke execute on function public.confirm_charger_submission(uuid, jsonb) from anon, public;
grant execute on function public.confirm_vehicle_submission(uuid, jsonb) to authenticated;
grant execute on function public.confirm_charger_submission(uuid, jsonb) to authenticated;

-- Users may no longer touch a submission once it produced a catalog row.
drop policy "users delete their own pending submissions" on public.catalog_submissions;
create policy "users delete their own unconfirmed submissions"
  on public.catalog_submissions for delete to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'pending'
    and created_variant_id is null
    and created_charger_model_id is null
  );

-- Generic home chargers -----------------------------------------------------------------------
-- Production reference data: one entry per common home setup, so every user finds theirs even
-- before the brand catalog grows. Branded models come from AI lookups reviewed by an admin.

insert into public.charger_models (
  brand, model, kind, rated_kw, phases, max_amperage_a, adjustable_amperage,
  input_voltage_min, input_voltage_max, tethered_cable, field_sources, status, source_ref
) values
  ('Genérico', 'Cargador portátil Nivel 1 (110–120 V, 16 A)', 'portable', 1.9, 1, 16,
   '{8,10,12,16}', 100, 130, true,
   '{"rated_kw": {"source": "Elacharger", "confidence": 1}}', 'verified', 'elacharger:portable-l1-16a'),
  ('Genérico', 'Cargador portátil Nivel 2 (220–240 V, 16 A)', 'portable', 3.7, 1, 16,
   '{6,8,10,13,16}', 200, 250, true,
   '{"rated_kw": {"source": "Elacharger", "confidence": 1}}', 'verified', 'elacharger:portable-l2-16a'),
  ('Genérico', 'Wallbox monofásico 7,4 kW (32 A)', 'wallbox', 7.4, 1, 32,
   '{6,10,16,20,25,32}', 200, 250, true,
   '{"rated_kw": {"source": "Elacharger", "confidence": 1}}', 'verified', 'elacharger:wallbox-1p-32a'),
  ('Genérico', 'Wallbox trifásico 11 kW (16 A)', 'wallbox', 11, 3, 16,
   '{6,10,13,16}', 200, 415, true,
   '{"rated_kw": {"source": "Elacharger", "confidence": 1}}', 'verified', 'elacharger:wallbox-3p-16a'),
  ('Genérico', 'Wallbox trifásico 22 kW (32 A)', 'wallbox', 22, 3, 32,
   '{6,10,16,20,25,32}', 200, 415, true,
   '{"rated_kw": {"source": "Elacharger", "confidence": 1}}', 'verified', 'elacharger:wallbox-3p-32a');
