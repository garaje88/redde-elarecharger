begin;
select plan(11);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset

-- Idempotency keys are private to their owner.
select tests.authenticate_as(:'ana');
select lives_ok(
  $$ insert into public.idempotency_keys (key, request_hash) values ('k-1', repeat('a', 64)) $$,
  'users store their own idempotency keys'
);
select throws_ok(
  format(
    $$ insert into public.idempotency_keys (user_id, key, request_hash) values (%L, 'k-2', repeat('a', 64)) $$,
    :'beto'
  ),
  '42501', null, 'users cannot store keys for somebody else'
);

select tests.authenticate_as(:'beto');
select is_empty($$ select 1 from public.idempotency_keys $$, 'keys are invisible to other users');
select lives_ok(
  $$ insert into public.idempotency_keys (key, request_hash) values ('k-1', repeat('b', 64)) $$,
  'the same key is independent per user'
);
update public.idempotency_keys set response_status = 201 where user_id <> auth.uid();
select tests.clear_authentication();
select is(
  (select response_status from public.idempotency_keys where user_id = :'ana' and key = 'k-1'),
  null,
  'users cannot touch other users'' keys'
);

-- Privacy settings.
select tests.authenticate_as(:'ana');
select lives_ok(
  $$ update public.profiles set store_route_geometry = false, privacy_accepted_at = now(),
       privacy_version = '2026-11' where id = auth.uid() $$,
  'users change their privacy settings'
);

-- Account deletion.
insert into public.vehicles (nickname) values ('Mío');
select tests.authenticate_as_anon();
select throws_ok('select public.delete_my_account()', '42501', null, 'anonymous callers cannot delete');

select tests.authenticate_as(:'ana');
select lives_ok('select public.delete_my_account()', 'users delete their own account');

select tests.clear_authentication();
select is_empty(format('select 1 from auth.users where id = %L', :'ana'), 'the auth user is gone');
select is_empty(
  format(
    $$ select 1 from public.vehicles where owner_id = %1$L
       union all select 1 from public.profiles where id = %1$L
       union all select 1 from public.idempotency_keys where user_id = %1$L $$,
    :'ana'
  ),
  'their data is deleted with them'
);
select ok(
  exists (select 1 from public.idempotency_keys where user_id = :'beto'),
  'other users keep their data'
);

select * from finish();
rollback;
