create table if not exists public.txline_session (
  id          boolean primary key default true check (id),
  jwt         text,
  api_token   text,
  expires_at  timestamptz,
  updated_at  timestamptz not null default now()
);
alter table public.txline_session enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net;
