-- Phase 7: privacy settings, consent, account deletion and idempotent POSTs.

-- Privacy (Ley 1581 de 2012) ----------------------------------------------------------

alter table public.profiles
  -- When false, saved trips keep the endpoints and results but not the full route line.
  add column store_route_geometry boolean not null default true,
  add column privacy_accepted_at timestamptz,
  add column privacy_version text check (length(privacy_version) <= 20);

-- Account deletion --------------------------------------------------------------------

-- Deletes the caller's auth user; every user-owned row cascades (profiles, garage, history,
-- sessions, submissions, idempotency keys) and the audit log keeps the event without the user.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.audit_log (user_id, event, metadata)
  values (me, 'account_delete', '{}');
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Idempotency keys (docs/PLAN.md, convenciones de la API) -----------------------------

create table public.idempotency_keys (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (length(key) between 1 and 255),
  -- sha256 of method, path and body: a key reused with another request is rejected.
  request_hash text not null check (length(request_hash) = 64),
  -- Null while the first request is in flight.
  response_status smallint check (response_status between 200 and 499),
  response_body jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

comment on table public.idempotency_keys is
  'Responses to POSTs sent with an Idempotency-Key, replayed for 24 h.';

create index idempotency_keys_created on public.idempotency_keys (created_at);

alter table public.idempotency_keys enable row level security;
revoke all on public.idempotency_keys from anon;

create policy "owner reads idempotency keys" on public.idempotency_keys
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates idempotency keys" on public.idempotency_keys
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner updates idempotency keys" on public.idempotency_keys
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "owner deletes idempotency keys" on public.idempotency_keys
  for delete to authenticated using (user_id = (select auth.uid()));
