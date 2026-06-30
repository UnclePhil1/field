-- Field — engine support: cached TxLINE session + scheduled engine tick.

-- ───────────────────────── txline_session ─────────────────────────
-- The engine caches the TxLINE guest JWT + activated apiToken here so it
-- doesn't re-auth every tick. Single row (id = true). Service-role only.
create table if not exists public.txline_session (
  id          boolean primary key default true check (id),
  jwt         text,
  api_token   text,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.txline_session enable row level security;
-- No policies: only the service role (Edge Functions) may touch it.

-- ───────────────────────── scheduled engine tick ─────────────────────────
-- This migration only enables the extensions the scheduler needs. The cron job
-- itself is registered MANUALLY (see supabase/schedule_cron.sql), because the
-- job has to embed the real function URL + CRON_SECRET as literals — hosted
-- Supabase does not allow `ALTER DATABASE ... SET` from the SQL editor, so the
-- `app.settings.*` indirection can't be used.
create extension if not exists pg_cron;
create extension if not exists pg_net;
