begin;
select plan(17);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset

insert into public.ev_brands (id, name, slug) values ('00000000-0000-4000-8000-0000000000b1', 'Zorro Motors', 'zorro-motors');
insert into public.ev_models (id, brand_id, name, slug, aliases) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'Q-07', 'q07', '{Q7}'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1', 'Oculto', 'oculto', '{}');
insert into public.ev_variants (model_id, year_from, trim, status, submitted_by) values
  ('00000000-0000-4000-8000-0000000000a1', 2025, 'Base', 'verified', null),
  ('00000000-0000-4000-8000-0000000000a2', 2025, 'Aporte de Ana', 'pending', :'ana');

-- Normalization makes punctuation and case irrelevant.
select is(public.catalog_normalize('Zorro  Q-07'), 'zorro q07', 'normalizes case, spacing and dashes');
select is(
  (select search_text from public.ev_models where id = '00000000-0000-4000-8000-0000000000a1'),
  'zorro motors q07 q7',
  'model search text includes brand and aliases'
);

update public.ev_brands set name = 'Zorro EV' where id = '00000000-0000-4000-8000-0000000000b1';
select is(
  (select search_text from public.ev_models where id = '00000000-0000-4000-8000-0000000000a1'),
  'zorro ev q07 q7',
  'renaming a brand refreshes its models'
);

select tests.authenticate_as(:'beto');
select results_eq(
  $$ select name from public.search_ev_models('zorro q-07') $$,
  array['Q-07'],
  'finds a model by brand and model with different punctuation'
);
select results_eq(
  $$ select name from public.search_ev_models('zoro q07') $$,
  array['Q-07'],
  'tolerates a typo'
);
select is_empty(
  $$ select 1 from public.search_ev_models('oculto') $$,
  'models with only someone else''s pending variants stay hidden'
);
select results_eq(
  $$ select name from public.search_ev_brands('zor') $$,
  array['Zorro EV'],
  'brand autocomplete by prefix'
);
select results_eq(
  $$ select model_count from public.search_ev_brands('zorro') $$,
  array[1::bigint],
  'brand model count only includes visible models'
);
select ok(
  (select count(*) from public.search_charger_models('wallbox monofasico') where brand = 'Genérico') >= 1,
  'finds the generic single-phase wallbox'
);

select tests.authenticate_as(:'ana');
select results_eq(
  $$ select name from public.search_ev_models('oculto') $$,
  array['Oculto'],
  'Ana finds the model of her own contribution'
);

-- Confirming a lookup creates a pending variant visible only to its author.
insert into public.catalog_submissions (id, user_id, kind, query)
  values ('00000000-0000-4000-8000-0000000000c1', :'ana', 'vehicle', 'Nube X1');
select lives_ok(
  $$ select public.confirm_vehicle_submission('00000000-0000-4000-8000-0000000000c1',
       '{"brand": "Nube", "model": "X1", "year_from": 2026, "battery_usable_kwh": 50,
         "range_km": 400, "range_cycle": "WLTP", "connector_ac": "TYPE2", "connector_dc": "CCS2"}') $$,
  'Ana confirms her lookup'
);
select results_eq(
  $$ select v.status::text, v.submitted_by, c.code
     from public.ev_variants v
     join public.catalog_submissions s on s.created_variant_id = v.id
     join public.connector_types c on c.id = v.connector_dc_id
     where s.id = '00000000-0000-4000-8000-0000000000c1' $$,
  $$ values ('pending', '$$ || :'ana' || $$'::uuid, 'CCS2') $$,
  'the new variant is pending, owned by Ana, with its connectors'
);
select throws_ok(
  $$ select public.confirm_vehicle_submission('00000000-0000-4000-8000-0000000000c1', '{"brand": "Nube", "model": "X1", "year_from": 2026}') $$,
  '23505', null, 'a submission is confirmed only once'
);
select is_empty(
  $$ delete from public.catalog_submissions where id = '00000000-0000-4000-8000-0000000000c1' returning 1 $$,
  'a confirmed submission can no longer be deleted by its author'
);

select tests.authenticate_as(:'beto');
select throws_ok(
  $$ select public.confirm_vehicle_submission('00000000-0000-4000-8000-0000000000c1', '{"brand": "Nube", "model": "X2", "year_from": 2026}') $$,
  'P0002', null, 'Beto cannot confirm Ana''s submission'
);
select is_empty(
  $$ select 1 from public.search_ev_models('nube x1') $$,
  'Beto does not see Ana''s pending contribution'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select * from public.search_ev_brands('') $$,
  '42501', null, 'anonymous visitors cannot search the catalog'
);

select * from finish();
rollback;
