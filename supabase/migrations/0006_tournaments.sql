-- Tournaments ("Prediction Battles"): public, free-entry contests on one match.
-- No escrow — the host declares a USDC prize and pays winners directly; Field
-- verifies the payment tx on-chain and never holds funds.

do $$ begin
  create type tournament_status as enum
    ('upcoming','live','settling','awaiting_payout','completed','voided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payout_status as enum ('awaiting_address','awaiting_payment','paid','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.tournaments (
  id                 text primary key default ('t_' || replace(gen_random_uuid()::text,'-','')),
  title              text not null,
  description        text not null default '',
  banner_url         text not null default '',
  host_user_id       uuid not null references public.profiles(id) on delete cascade,
  host_payout_wallet text not null,
  match_id           text not null references public.matches(id) on delete cascade,
  status             tournament_status not null default 'upcoming',
  prize_total        numeric not null check (prize_total > 0),
  prize_asset        text not null default 'USDC',
  capacity_type      text not null default 'open' check (capacity_type in ('open','slots')),
  capacity_max       integer,
  winners_count      integer not null check (winners_count between 1 and 5),
  split              jsonb not null,        -- int[] summing to 100
  starting_points    integer not null default 1000,
  join_closes        text not null default 'kickoff' check (join_closes in ('kickoff','matchEnd')),
  participant_count  integer not null default 0,
  settled_at         timestamptz,
  payout_deadline    timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists tournaments_status_idx on public.tournaments(status);
create index if not exists tournaments_match_idx on public.tournaments(match_id);

create table if not exists public.tournament_participants (
  id            uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  points        integer not null default 1000,
  rank          integer,
  unique (tournament_id, user_id)
);
create index if not exists tparticipants_tour_idx on public.tournament_participants(tournament_id, points desc);

-- Tournament-mode wagers: same cards as normal play, but staked from the stack.
create table if not exists public.tournament_predictions (
  id            uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  card_id       uuid not null references public.prediction_cards(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  pick          pick_kind not null,
  stake         integer not null check (stake >= 0),
  settled       boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (tournament_id, card_id, user_id)
);
create index if not exists tpred_card_idx on public.tournament_predictions(card_id) where settled = false;

create table if not exists public.tournament_payouts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  rank          integer not null,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  amount        numeric not null,
  asset         text not null default 'USDC',
  winner_wallet text,
  status        payout_status not null default 'awaiting_address',
  tx_sig        text,
  verified      boolean not null default false,
  paid_at       timestamptz,
  unique (tournament_id, rank)
);

-- ── RLS: public reads; all writes via Edge Functions (service role) ──
alter table public.tournaments             enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_predictions  enable row level security;
alter table public.tournament_payouts      enable row level security;

drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select using (true);
drop policy if exists tparticipants_read on public.tournament_participants;
create policy tparticipants_read on public.tournament_participants for select using (true);
drop policy if exists tpayouts_read on public.tournament_payouts;
create policy tpayouts_read on public.tournament_payouts for select using (true);
drop policy if exists tpred_read_own on public.tournament_predictions;
create policy tpred_read_own on public.tournament_predictions for select using (auth.uid() = user_id);

-- ── realtime ──
do $$ begin alter publication supabase_realtime add table public.tournaments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournament_participants; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tournament_payouts; exception when duplicate_object then null; end $$;
