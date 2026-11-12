-- The reported battery level of a vehicle: limits, pairing with its time and row ownership.
begin;
select plan(6);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset
select tests.authenticate_as(:'ana');
insert into public.vehicles (nickname) values ('Carro de Ana') returning id as ana_vehicle \gset

select lives_ok(
  format($$ update public.vehicles set current_soc = 64, current_soc_at = now() where id = %L $$, :'ana_vehicle'),
  'the owner can report the battery level'
);
select is(
  (select current_soc from public.vehicles where id = :'ana_vehicle'),
  64.00::numeric(5, 2),
  'the level is stored'
);
select throws_ok(
  format($$ update public.vehicles set current_soc = 120 where id = %L $$, :'ana_vehicle'),
  '23514', null, 'the level cannot exceed 100'
);
select throws_ok(
  format($$ update public.vehicles set current_soc_at = null where id = %L $$, :'ana_vehicle'),
  '23514', null, 'a level always carries the time it was reported'
);

select tests.authenticate_as(:'beto');
update public.vehicles set current_soc = 5, current_soc_at = now() where id = :'ana_vehicle';
select tests.authenticate_as(:'ana');
select is(
  (select current_soc from public.vehicles where id = :'ana_vehicle'),
  64.00::numeric(5, 2),
  'another user cannot change it'
);
select lives_ok(
  format($$ update public.vehicles set current_soc = null, current_soc_at = null where id = %L $$, :'ana_vehicle'),
  'the owner can clear it'
);

select * from finish();
rollback;
