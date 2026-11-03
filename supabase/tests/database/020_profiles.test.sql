begin;
select plan(7);

select tests.create_user('ana@gmail.com', 'Ana Gómez') as ana \gset
select tests.create_user('beto@gmail.com', 'Beto Ruiz') as beto \gset

select is(
  (select display_name from public.profiles where id = :'ana'),
  'Ana Gómez',
  'handle_new_user creates the profile from the Google name'
);

select tests.authenticate_as(:'ana');

select results_eq(
  'select id from public.profiles',
  array[:'ana'::uuid],
  'a user sees only their own profile'
);

select lives_ok(
  $$ update public.profiles set tariff_per_kwh = 950, reserve_pct = 15 $$,
  'a user updates their own profile'
);

update public.profiles set display_name = 'hacked' where id = :'beto';
select tests.clear_authentication();
select is(
  (select display_name from public.profiles where id = :'beto'),
  'Beto Ruiz',
  'a user cannot update another profile'
);

select tests.authenticate_as(:'ana');
select throws_ok(
  format($$ insert into public.profiles (id) values (%L) $$, gen_random_uuid()),
  '42501',
  null,
  'users cannot insert profiles directly'
);

select throws_ok(
  $$ update public.profiles set reserve_pct = 80 $$,
  '23514',
  null,
  'reserve_pct is limited by a CHECK'
);

select tests.authenticate_as_anon();
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');

select * from finish();
rollback;
