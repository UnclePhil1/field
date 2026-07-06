-- Telegram delivery channel. Users opt in by starting the bot with a one-time
-- code; we store the resulting chat_id and fan the same notifications to it.
-- Free + unlimited (bot-initiated messages to users who've started the bot).

-- One Telegram chat per account (and one account per chat).
create table if not exists public.telegram_links (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  chat_id    text not null unique,
  tg_username text,
  linked_at  timestamptz not null default now()
);

-- Short-lived codes handed to the client; the bot's /start <code> claims one.
create table if not exists public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists tg_link_codes_user_idx on public.telegram_link_codes(user_id);

-- Per-match one-shot flags so broadcasts fire exactly once.
alter table public.matches add column if not exists kickoff_notified boolean not null default false;
alter table public.matches add column if not exists ft_notified      boolean not null default false;
alter table public.matches add column if not exists pre_notified      boolean not null default false;

-- ── RLS: a user may see their own link (to show "connected"); all writes are
-- service-role only (the webhook + link functions). Codes are never client-read.
alter table public.telegram_links      enable row level security;
alter table public.telegram_link_codes enable row level security;

drop policy if exists tg_links_read_own on public.telegram_links;
create policy tg_links_read_own on public.telegram_links for select using (auth.uid() = user_id);
