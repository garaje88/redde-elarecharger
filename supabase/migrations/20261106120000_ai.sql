-- Phase 8: AI features (docs/PLAN.md, Funcionalidades de IA). The AI reads and extracts; every
-- number shown to the user still comes from packages/calc.

create type public.ai_extraction_kind as enum ('vehicle_spec', 'charging_receipt');
create type public.ai_extraction_status as enum ('pending', 'confirmed', 'discarded');
create type public.ai_feature as enum (
  'catalog_lookup', 'vehicle_spec', 'charging_receipt', 'assistant'
);

-- Assistant history is optional (IA3): users can turn it off in Ajustes.
alter table public.profiles
  add column store_ai_conversations boolean not null default true;

-- Drafts extracted from an uploaded sheet or photo (IA1, IA2) -------------------------

create table public.ai_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.ai_extraction_kind not null,
  -- The upload it was read from; the file itself is deleted after extraction (or within 24 h).
  storage_path text not null check (length(storage_path) between 1 and 300),
  extracted jsonb not null default '{}' check (jsonb_typeof(extracted) = 'object'),
  confidence jsonb not null default '{}' check (jsonb_typeof(confidence) = 'object'),
  status public.ai_extraction_status not null default 'pending',
  model text not null check (length(model) between 1 and 100),
  -- IA1 drafts become a catalog submission so the user confirms them like a web lookup.
  submission_id uuid references public.catalog_submissions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_extractions_user on public.ai_extractions (user_id, created_at desc);

create trigger set_updated_at before update on public.ai_extractions
for each row execute function public.set_updated_at();

alter table public.ai_extractions enable row level security;
revoke all on public.ai_extractions from anon;

create policy "owner reads extractions" on public.ai_extractions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates extractions" on public.ai_extractions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (
      submission_id is null
      or exists (
        select 1 from public.catalog_submissions s
        where s.id = submission_id and s.user_id = (select auth.uid())
      )
    )
  );
create policy "owner updates extractions" on public.ai_extractions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "owner deletes extractions" on public.ai_extractions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Assistant conversations (IA3) -------------------------------------------------------

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  -- The model transcript, replayed as-is on the next turn.
  messages jsonb not null default '[]' check (jsonb_typeof(messages) = 'array'),
  -- Result cards (trip, charge, stats) keyed by the tool call that produced them.
  cards jsonb not null default '{}' check (jsonb_typeof(cards) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user on public.ai_conversations (user_id, updated_at desc);

create trigger set_updated_at before update on public.ai_conversations
for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
revoke all on public.ai_conversations from anon;

create policy "owner reads conversations" on public.ai_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "owner creates conversations" on public.ai_conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "owner updates conversations" on public.ai_conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "owner deletes conversations" on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- Usage and limits --------------------------------------------------------------------

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature public.ai_feature not null,
  model text not null check (length(model) between 1 and 100),
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  est_cost_usd numeric(10, 6) not null check (est_cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_user on public.ai_usage (user_id, feature, created_at desc);
create index ai_usage_created on public.ai_usage (created_at);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Owners only read; rows are written by record_ai_usage, so nobody can edit or delete them.
create policy "owner reads usage" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

-- The server records what a call cost, as the calling user. A user calling it directly can only
-- add usage to themselves, which only brings their own limits closer.
create function public.record_ai_usage(
  feature public.ai_feature,
  model text,
  input_tokens integer,
  output_tokens integer,
  est_cost_usd numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.ai_usage (user_id, feature, model, input_tokens, output_tokens, est_cost_usd)
  values (auth.uid(), feature, model, input_tokens, output_tokens, est_cost_usd);
end;
$$;

revoke all on function public.record_ai_usage(public.ai_feature, text, integer, integer, numeric)
  from public, anon;
grant execute on function public.record_ai_usage(public.ai_feature, text, integer, integer, numeric)
  to authenticated;

-- Global spend this calendar month (UTC), for the monthly budget cap.
create function public.ai_spend_this_month()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(est_cost_usd), 0)
  from public.ai_usage
  where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;

revoke all on function public.ai_spend_this_month() from public, anon;
grant execute on function public.ai_spend_this_month() to authenticated;

-- Uploads: private bucket, one folder per user -----------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-uploads', 'ai-uploads', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

create policy "owner uploads to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "owner reads own uploads" on storage.objects
  for select to authenticated using (
    bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "owner deletes own uploads" on storage.objects
  for delete to authenticated using (
    bucket_id = 'ai-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text
  );
