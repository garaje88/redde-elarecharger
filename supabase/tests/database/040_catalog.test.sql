begin;
select plan(13);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset
select tests.create_user('admin@gmail.com') as admin \gset

insert into public.ev_brands (id, name, slug) values ('00000000-0000-4000-8000-0000000000b1', 'Marca', 'marca');
insert into public.ev_models (id, brand_id, name, slug)
  values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', 'Modelo', 'modelo');
insert into public.ev_variants (model_id, year_from, trim, status, submitted_by) values
  ('00000000-0000-4000-8000-0000000000a1', 2025, 'verificada', 'verified', null),
  ('00000000-0000-4000-8000-0000000000a1', 2025, 'aporte de Ana', 'pending', :'ana');
insert into public.charger_models (brand, model, kind, rated_kw, status, submitted_by) values
  ('Marca', 'Wallbox 7', 'wallbox', 7.4, 'verified', null),
  ('Marca', 'Portátil de Ana', 'portable', 2.3, 'pending', :'ana');

-- Anonymous visitors only see connector reference data.
select tests.authenticate_as_anon();
select isnt_empty('select 1 from public.connector_types', 'anon reads connector types');
select is_empty('select 1 from public.ev_variants', 'anon sees no variants');

-- Authenticated users read verified rows plus their own pending contributions.
select tests.authenticate_as(:'beto');
select results_eq(
  $$ select trim from public.ev_variants where model_id = '00000000-0000-4000-8000-0000000000a1' order by trim $$,
  array['verificada'],
  'Beto sees only verified variants'
);
select results_eq(
  $$ select model from public.charger_models where brand = 'Marca' order by model $$,
  array['Wallbox 7'],
  'Beto sees only verified chargers'
);

select tests.authenticate_as(:'ana');
select results_eq(
  $$ select trim from public.ev_variants where model_id = '00000000-0000-4000-8000-0000000000a1' order by trim $$,
  array['aporte de Ana', 'verificada'],
  'Ana also sees her own pending variant'
);

-- The catalog is read-only for users.
select throws_ok(
  $$ insert into public.ev_brands (name, slug) values ('Falsa', 'falsa') $$,
  '42501', null, 'users cannot create brands'
);
select throws_ok(
  $$ update public.ev_variants set battery_usable_kwh = 999 $$,
  '42501', null, 'users cannot edit variants'
);

-- Submissions: users create pending ones and only see their own.
insert into public.catalog_submissions (kind, query) values ('vehicle', 'BYD Dolphin Mini 2025');
select throws_ok(
  $$ insert into public.catalog_submissions (kind, query, status, reviewed_at)
     values ('vehicle', 'auto aprobado', 'approved', now()) $$,
  '42501', null, 'users cannot self-approve submissions'
);

select tests.authenticate_as(:'beto');
select is_empty('select 1 from public.catalog_submissions', 'Beto cannot read Ana''s submissions');
select is_empty(
  $$ update public.catalog_submissions set status = 'approved', reviewed_at = now() returning id $$,
  'regular users cannot review submissions'
);

-- Administrators (app_metadata.role = admin) review every submission.
select tests.authenticate_as(:'admin', 'admin');
select is(
  (select count(*)::int from public.catalog_submissions where user_id in (:'ana', :'beto')),
  1,
  'admins read all submissions'
);
select isnt_empty(
  format($$ update public.catalog_submissions
            set status = 'approved', reviewed_by = %L, reviewed_at = now() returning id $$, :'admin'),
  'admins approve submissions'
);

-- Import log is server-only.
select tests.authenticate_as(:'ana');
select throws_ok('select 1 from public.catalog_sync_runs', '42501', null, 'users cannot read sync runs');

select * from finish();
rollback;
