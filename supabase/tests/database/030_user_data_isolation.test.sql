-- Phase 1 exit criterion: two users cannot read or modify each other's rows.
begin;
select plan(24);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset

-- Ana fills her garage and history.
select tests.authenticate_as(:'ana');

insert into public.vehicles (nickname) values ('Carro de Ana') returning id as ana_vehicle \gset
insert into public.chargers (name, voltage_v, circuit_amperage_a)
  values ('Wallbox casa', 220, 32) returning id as ana_charger \gset
insert into public.trip_calculations (
  vehicle_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, duration_min,
  start_soc, energy_kwh, consumed_pct, arrival_soc, engine_version
) values (:'ana_vehicle', 4.711, -74.072, 6.244, -75.581, 415, 540, 90, 66, 58.8, 31.2, '0.0.0')
  returning id as ana_trip \gset
insert into public.charge_calculations (
  vehicle_id, charger_id, start_soc, target_soc, effective_kw, energy_grid_kwh, duration_min,
  engine_version
) values (:'ana_vehicle', :'ana_charger', 20, 80, 5.9, 37.4, 340, '0.0.0');
insert into public.charging_sessions (vehicle_id, charger_id, started_at, start_soc, end_soc)
  values (:'ana_vehicle', :'ana_charger', now() - interval '6 hours', 20, 80);

select isnt_empty('select 1 from public.vehicles', 'Ana sees her vehicle');

-- Beto sees none of it.
select tests.authenticate_as(:'beto');

select is_empty('select 1 from public.vehicles', 'Beto cannot read Ana''s vehicles');
select is_empty('select 1 from public.chargers', 'Beto cannot read Ana''s chargers');
select is_empty('select 1 from public.trip_calculations', 'Beto cannot read Ana''s trips');
select is_empty('select 1 from public.charge_calculations', 'Beto cannot read Ana''s charge calculations');
select is_empty('select 1 from public.charging_sessions', 'Beto cannot read Ana''s charging sessions');

-- Updates and deletes on Ana's rows silently affect zero rows.
select is_empty(
  format($$ update public.vehicles set nickname = 'robado' where id = %L returning id $$, :'ana_vehicle'),
  'Beto cannot update Ana''s vehicle'
);
select is_empty(
  format($$ delete from public.vehicles where id = %L returning id $$, :'ana_vehicle'),
  'Beto cannot delete Ana''s vehicle'
);
select is_empty(
  format($$ update public.chargers set voltage_v = 240 where id = %L returning id $$, :'ana_charger'),
  'Beto cannot update Ana''s charger'
);
select is_empty(
  format($$ delete from public.chargers where id = %L returning id $$, :'ana_charger'),
  'Beto cannot delete Ana''s charger'
);
select is_empty(
  format($$ delete from public.trip_calculations where id = %L returning id $$, :'ana_trip'),
  'Beto cannot delete Ana''s trip'
);
select is_empty(
  'update public.charge_calculations set cost = 0 returning id',
  'Beto cannot update Ana''s charge calculations'
);
select is_empty(
  'delete from public.charging_sessions returning id',
  'Beto cannot delete Ana''s charging sessions'
);

-- Beto cannot write rows on Ana's behalf.
select throws_ok(
  format($$ insert into public.vehicles (owner_id, nickname) values (%L, 'falso') $$, :'ana'),
  '42501', null, 'Beto cannot create a vehicle owned by Ana'
);
select throws_ok(
  format($$ insert into public.chargers (owner_id, name, voltage_v, circuit_amperage_a)
            values (%L, 'falso', 220, 16) $$, :'ana'),
  '42501', null, 'Beto cannot create a charger owned by Ana'
);

-- Beto cannot point his own rows at Ana's vehicle or charger.
select throws_ok(
  format($$ insert into public.trip_calculations (
      vehicle_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, duration_min,
      start_soc, energy_kwh, consumed_pct, arrival_soc, engine_version
    ) values (%L, 0, 0, 0, 0, 1, 1, 50, 1, 1, 49, '0.0.0') $$, :'ana_vehicle'),
  '42501', null, 'Beto cannot attach a trip to Ana''s vehicle'
);
select throws_ok(
  format($$ insert into public.charge_calculations (
      charger_id, start_soc, target_soc, effective_kw, energy_grid_kwh, duration_min, engine_version
    ) values (%L, 20, 80, 5, 30, 300, '0.0.0') $$, :'ana_charger'),
  '42501', null, 'Beto cannot attach a charge calculation to Ana''s charger'
);
select throws_ok(
  format($$ insert into public.charging_sessions (vehicle_id, started_at) values (%L, now()) $$, :'ana_vehicle'),
  '42501', null, 'Beto cannot attach a charging session to Ana''s vehicle'
);
select throws_ok(
  format($$ update public.profiles set default_vehicle_id = %L $$, :'ana_vehicle'),
  '42501', null, 'Beto cannot set Ana''s vehicle as his default'
);

-- Beto's own data works normally and owner_id defaults to him.
insert into public.vehicles (nickname) values ('Carro de Beto');
select results_eq(
  'select owner_id from public.vehicles',
  array[:'beto'::uuid],
  'owner_id defaults to the caller'
);

-- Ana's rows are untouched.
select tests.clear_authentication();
select is(
  (select nickname from public.vehicles where id = :'ana_vehicle'),
  'Carro de Ana',
  'Ana''s vehicle is unchanged'
);
select is((select count(*)::int from public.chargers where owner_id = :'ana'), 1, 'Ana''s charger still exists');
select is((select count(*)::int from public.charging_sessions where user_id = :'ana'), 1, 'Ana''s session still exists');

-- Deleting the account cascades to every row.
delete from auth.users where id = :'ana';
select is(
  (select count(*)::int from public.vehicles where owner_id = :'ana')
    + (select count(*)::int from public.trip_calculations where user_id = :'ana')
    + (select count(*)::int from public.profiles where id = :'ana'),
  0,
  'deleting the user removes their data in cascade'
);

select * from finish();
rollback;
