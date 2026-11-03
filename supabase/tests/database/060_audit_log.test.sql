begin;
select plan(4);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.authenticate_as(:'ana');

select lives_ok($$ select public.log_audit_event('sign_in', '{"provider": "google"}') $$, 'users log their own events');
select throws_ok('select 1 from public.audit_log', '42501', null, 'users cannot read the audit log');
select throws_ok(
  $$ select public.log_audit_event('drop_tables') $$, '23514', null, 'only known events are accepted'
);

select tests.clear_authentication();
select is(
  (select user_id from public.audit_log where event = 'sign_in'),
  :'ana'::uuid,
  'events are attributed to the caller, not to a parameter'
);

select * from finish();
rollback;
