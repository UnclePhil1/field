create table if not exists public.match_predictions (
  match_id   text not null references public.matches(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  home_goals int not null check (home_goals between 0 and 20),
  away_goals int not null check (away_goals between 0 and 20),
  side       text not null check (side in ('home', 'away')),
  settled    boolean not null default false,
  points     int not null default 0,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists match_predictions_match_idx on public.match_predictions(match_id);

alter table public.match_predictions enable row level security;
