-- Field — core schema, RLS, and realtime.
-- All gameplay writes (matches, events, cards, settlements, coin/streak changes)
-- are performed by Edge Functions using the service role, which bypasses RLS.
-- Clients only ever read public game state + their own rows.

-- ───────────────────────── extensions ─────────────────────────
create extension if not exists pgcrypto;

-- ───────────────────────── enums ─────────────────────────
do $$ begin
  create type match_status as enum ('upcoming', 'live', 'finished');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_phase as enum ('PRE','1H','HT','2H','ET','FT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stat_kind as enum ('goal','card','corner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type side_kind as enum ('home','away');
exception when duplicate_object then null; end $$;

do $$ begin
  create type card_status as enum ('live','locked','settled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pick_kind as enum ('yes','no');
exception when duplicate_object then null; end $$;

do $$ begin
  create type settlement_result as enum ('win','loss','void');
exception when duplicate_object then null; end $$;

-- ───────────────────────── profiles ─────────────────────────
-- One row per authenticated wallet. id == auth.users.id.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  wallet        text unique not null,
  username      text unique,
  coins         integer not null default 1000,
  streak        integer not null default 0,
  allowance_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- ───────────────────────── matches ─────────────────────────
create table if not exists public.matches (
  id                text primary key,            -- our slug or txline fixture id as text
  txline_fixture_id bigint unique,
  competition       text not null default 'World Cup',
  home_code         text not null,
  home_name         text not null,
  away_code         text not null,
  away_name         text not null,
  status            match_status not null default 'upcoming',
  phase             match_phase not null default 'PRE',
  minute            integer not null default 0,
  home_score        integer not null default 0,
  away_score        integer not null default 0,
  kickoff           timestamptz,
  updated_at        timestamptz not null default now()
);
create index if not exists matches_status_idx on public.matches(status);

-- ───────────────────────── match_events ─────────────────────────
create table if not exists public.match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   text not null references public.matches(id) on delete cascade,
  kind       stat_kind not null,
  side       side_kind not null,
  minute     integer not null default 0,
  label      text not null,
  x          real not null default 0.5,
  y          real not null default 0.5,
  seq        bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists match_events_match_idx on public.match_events(match_id, seq desc);

-- ───────────────────────── prediction_cards ─────────────────────────
create table if not exists public.prediction_cards (
  id                  uuid primary key default gen_random_uuid(),
  match_id            text not null references public.matches(id) on delete cascade,
  status              card_status not null default 'live',
  stat                stat_kind not null,
  side                side_kind not null,
  question            text not null,
  subject_team        text not null,
  multiplier          real not null default 2.0,
  locks_at            timestamptz not null,
  window_seconds      integer not null default 300,
  crowd_yes           integer not null default 50,
  sync_line           text,
  txline_stat_key     integer,                     -- (period*1000)+base, see txline guide
  baseline_stat       integer,                     -- stat value captured when the card opened
  txline_seq          bigint,                      -- TxLINE update seq used at settlement (for proofs)
  -- present once settled:
  outcome             pick_kind,
  resolved_stat_label text,
  receipt             jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists cards_match_idx on public.prediction_cards(match_id, created_at desc);
create index if not exists cards_open_idx on public.prediction_cards(status) where status <> 'settled';

-- ───────────────────────── predictions (user calls) ─────────────────────────
create table if not exists public.predictions (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.prediction_cards(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  pick       pick_kind not null,
  stake      integer not null check (stake > 0),
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);
create index if not exists predictions_user_idx on public.predictions(user_id, created_at desc);
create index if not exists predictions_card_idx on public.predictions(card_id);

-- ───────────────────────── settlements ─────────────────────────
create table if not exists public.settlements (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.prediction_cards(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  result     settlement_result not null,
  pick       pick_kind not null,
  stake      integer not null,
  payout     integer not null default 0,
  points     integer not null default 0,
  minute     integer not null default 0,
  question   text not null default '',
  receipt    jsonb not null,
  created_at timestamptz not null default now(),
  unique (card_id, user_id)
);
create index if not exists settlements_user_idx on public.settlements(user_id, created_at desc);

-- ───────────────────────── leaderboard views ─────────────────────────
-- Tournament-long board straight off profiles.
create or replace view public.leaderboard as
  select
    p.id,
    coalesce(p.username, 'anon') as name,
    '@' || coalesce(p.username, substr(p.wallet, 1, 6)) as handle,
    p.streak,
    p.coins as points
  from public.profiles p
  where p.username is not null
  order by p.coins desc, p.streak desc;

-- Per-match board from settlements (points earned in that match).
create or replace view public.match_leaderboard as
  select
    s.card_id,
    c.match_id,
    s.user_id as id,
    coalesce(p.username, 'anon') as name,
    '@' || coalesce(p.username, substr(p.wallet, 1, 6)) as handle,
    p.streak,
    sum(s.points) over (partition by c.match_id, s.user_id) as points
  from public.settlements s
  join public.prediction_cards c on c.id = s.card_id
  join public.profiles p on p.id = s.user_id;

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles         enable row level security;
alter table public.matches          enable row level security;
alter table public.match_events     enable row level security;
alter table public.prediction_cards enable row level security;
alter table public.predictions      enable row level security;
alter table public.settlements      enable row level security;

-- Public game state: anyone (incl. anon key) may read.
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select using (true);

drop policy if exists events_read on public.match_events;
create policy events_read on public.match_events for select using (true);

drop policy if exists cards_read on public.prediction_cards;
create policy cards_read on public.prediction_cards for select using (true);

-- Profiles: public read (leaderboard needs name/handle/streak/coins);
-- a user may update only their own row (and never via this path change coins —
-- coins/streak are only mutated by the service role in Edge Functions).
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Predictions & settlements: a user reads only their own.
drop policy if exists predictions_read_own on public.predictions;
create policy predictions_read_own on public.predictions
  for select using (auth.uid() = user_id);

drop policy if exists settlements_read_own on public.settlements;
create policy settlements_read_own on public.settlements
  for select using (auth.uid() = user_id);

-- NOTE: no insert/update policies for gameplay tables — all writes go through
-- Edge Functions with the service role, which bypasses RLS entirely.

-- ───────────────────────── realtime ─────────────────────────
-- Push live changes to subscribed clients.
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.match_events;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.prediction_cards;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.settlements;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
