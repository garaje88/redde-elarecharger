begin;
select plan(21);

select tests.create_user('ana@gmail.com') as ana \gset
select tests.create_user('beto@gmail.com') as beto \gset

-- Extractions -------------------------------------------------------------------------
select tests.authenticate_as(:'ana');
select lives_ok(
  $$ insert into public.ai_extractions (kind, storage_path, extracted, model)
     values ('charging_receipt', 'x/receipt.jpg', '{"energy_kwh": 30}', 'claude-sonnet-5-5') $$,
  'users store their own extraction drafts'
);
select throws_ok(
  format(
    $$ insert into public.ai_extractions (user_id, kind, storage_path, model)
       values (%L, 'vehicle_spec', 'x/sheet.pdf', 'm') $$,
    :'beto'
  ),
  '42501', null, 'users cannot create drafts for somebody else'
);
insert into public.catalog_submissions (kind, query) values ('vehicle', 'Deepal S05')
returning id as ana_submission \gset

select tests.authenticate_as(:'beto');
select is_empty($$ select 1 from public.ai_extractions $$, 'drafts are invisible to other users');
select throws_ok(
  format(
    $$ insert into public.ai_extractions (kind, storage_path, model, submission_id)
       values ('vehicle_spec', 'x/sheet.pdf', 'm', %L) $$,
    :'ana_submission'
  ),
  '42501', null, 'a draft cannot point at somebody else''s submission'
);
update public.ai_extractions set status = 'discarded';
select tests.clear_authentication();
select is(
  (select status::text from public.ai_extractions where user_id = :'ana'),
  'pending',
  'users cannot change other users'' drafts'
);

-- Conversations -----------------------------------------------------------------------
select tests.authenticate_as(:'ana');
select lives_ok(
  $$ insert into public.ai_conversations (title, messages)
     values ('¿Llego a Girardot?', '[{"role": "user", "content": "hola"}]') $$,
  'users store their own conversations'
);
select throws_ok(
  $$ insert into public.ai_conversations (title, messages) values ('x', '{}') $$,
  '23514', null, 'messages must be an array'
);
select tests.authenticate_as(:'beto');
select is_empty($$ select 1 from public.ai_conversations $$, 'conversations are private');

-- Usage -------------------------------------------------------------------------------
select tests.clear_authentication();
select public.ai_spend_this_month() as spend_before \gset
select tests.authenticate_as(:'ana');
select lives_ok(
  $$ select public.record_ai_usage('assistant', 'claude-opus-5-5', 1200, 300, 0.0108) $$,
  'the server records usage as the calling user'
);
select is(
  (select count(*)::int from public.ai_usage where feature = 'assistant'),
  1,
  'users read their own usage'
);
select throws_ok(
  $$ insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens, est_cost_usd)
     values (auth.uid(), 'assistant', 'm', 0, 0, 0) $$,
  '42501', null, 'usage is written only through record_ai_usage'
);
select throws_ok(
  $$ delete from public.ai_usage $$,
  '42501', null, 'users cannot erase their usage'
);
select throws_ok(
  $$ select public.record_ai_usage('assistant', 'm', -1, 0, 0) $$,
  '23514', null, 'token counts cannot be negative'
);

select tests.authenticate_as(:'beto');
select is_empty($$ select 1 from public.ai_usage $$, 'usage is private');
select is(
  public.ai_spend_this_month(),
  :spend_before + 0.0108,
  'the monthly spend adds every user'
);

select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.record_ai_usage('assistant', 'm', 1, 1, 0) $$,
  '42501', null, 'anonymous callers cannot record usage'
);

-- Uploads bucket ----------------------------------------------------------------------
select tests.clear_authentication();
select is(
  (select public from storage.buckets where id = 'ai-uploads'),
  false,
  'the uploads bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'ai-uploads'),
  10485760::bigint,
  'uploads are capped at 10 MB'
);
select tests.authenticate_as(:'ana');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('ai-uploads', %L) $$, :'ana' || '/a.jpg'),
  'users upload into their own folder'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('ai-uploads', %L) $$, :'beto' || '/a.jpg'),
  '42501', null, 'users cannot upload into another user''s folder'
);
select tests.authenticate_as(:'beto');
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'ai-uploads' $$,
  'uploads are invisible to other users'
);

select * from finish();
rollback;
