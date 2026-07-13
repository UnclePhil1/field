create table if not exists public.score_link_picks (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null references public.matches(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  home_goals  int not null check (home_goals between 0 and 9),
  away_goals  int not null check (away_goals between 0 and 9),
  stake       int not null check (stake > 0),
  multiplier  numeric not null,     -- locked at pick time
  entry_cents numeric not null,
  settled     boolean not null default false,
  won         boolean,
  payout      int not null default 0,
  created_at  timestamptz not null default now(),
  unique (match_id, user_id, home_goals, away_goals)
);
create index if not exists score_link_match_idx on public.score_link_picks(match_id);

alter table public.score_link_picks enable row level security;
drop policy if exists slp_read_own on public.score_link_picks;
create policy slp_read_own on public.score_link_picks for select using (auth.uid() = user_id);
