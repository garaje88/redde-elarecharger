-- CHECK constraints mirror the Zod limits used by the API.
begin;
select plan(13);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.authenticate_as(:'ana');

select throws_ok(
  $$ insert into public.chargers (name, voltage_v, circuit_amperage_a) values ('x', 50, 16) $$,
  '23514', null, 'voltage_v must be between 100 and 1000'
);
select throws_ok(
  $$ insert into public.chargers (name, voltage_v, phases, circuit_amperage_a) values ('x', 220, 2, 16) $$,
  '23514', null, 'phases must be 1 or 3'
);
select throws_ok(
  $$ insert into public.chargers (name, voltage_v, circuit_amperage_a) values ('x', 220, 600) $$,
  '23514', null, 'circuit amperage must be between 1 and 500'
);
select throws_ok(
  $$ insert into public.charge_calculations (start_soc, target_soc, effective_kw, energy_grid_kwh, duration_min, engine_version)
     values (80, 50, 5, 1, 1, '0') $$,
  '23514', null, 'target_soc must be greater than start_soc'
);
select throws_ok(
  $$ insert into public.charge_calculations (start_soc, target_soc, effective_kw, energy_grid_kwh, duration_min, engine_version)
     values (20, 120, 5, 1, 1, '0') $$,
  '23514', null, 'soc cannot exceed 100'
);
select throws_ok(
  $$ insert into public.trip_calculations (origin_lat, origin_lng, dest_lat, dest_lng, distance_km, duration_min,
       start_soc, energy_kwh, consumed_pct, arrival_soc, engine_version)
     values (91, 0, 0, 0, 1, 1, 50, 1, 1, 49, '0') $$,
  '23514', null, 'latitude must be within -90..90'
);
select throws_ok(
  $$ insert into public.trip_calculations (origin_lat, origin_lng, dest_lat, dest_lng, distance_km, duration_min,
       start_soc, energy_kwh, consumed_pct, arrival_soc, engine_version)
     values (0, 181, 0, 0, 1, 1, 50, 1, 1, 49, '0') $$,
  '23514', null, 'longitude must be within -180..180'
);
select throws_ok(
  $$ insert into public.vehicles (nickname, overrides) values ('x', '[]') $$,
  '23514', null, 'vehicle overrides must be a JSON object'
);

-- Catalog constraints, checked as the importer (service role) would write.
select tests.clear_authentication();
insert into public.ev_brands (id, name, slug) values ('00000000-0000-4000-8000-0000000000b1', 'Marca', 'marca');
insert into public.ev_models (id, brand_id, name, slug)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'Modelo', 'modelo');

select throws_ok(
  $$ insert into public.ev_variants (model_id, year_from, battery_gross_kwh, battery_usable_kwh)
     values ('00000000-0000-4000-8000-0000000000a1', 2025, 50, 60) $$,
  '23514', null, 'usable capacity cannot exceed gross capacity'
);
select lives_ok(
  $$ insert into public.ev_variants (model_id, year_from, charge_curve)
     values ('00000000-0000-4000-8000-0000000000a1', 2025, '[{"soc": 0, "kw": 60}, {"soc": 80, "kw": 60}, {"soc": 100, "kw": 20}]') $$,
  'a well-formed charge curve is accepted'
);
select throws_ok(
  $$ insert into public.ev_variants (model_id, year_from, charge_curve)
     values ('00000000-0000-4000-8000-0000000000a1', 2025, '[{"soc": 120, "kw": 60}]') $$,
  '23514', null, 'charge curve soc must be within 0..100'
);
select throws_ok(
  $$ insert into public.ev_variants (model_id, year_from, charge_curve)
     values ('00000000-0000-4000-8000-0000000000a1', 2025, '[{"soc": "x", "kw": 0}]') $$,
  '23514', null, 'charge curve points need numeric soc and positive kw'
);
select throws_ok(
  $$ insert into public.ev_variants (model_id, year_from, charge_curve)
     values ('00000000-0000-4000-8000-0000000000a1', 2025, '{}') $$,
  '23514', null, 'charge curve must be an array'
);

select * from finish();
rollback;
