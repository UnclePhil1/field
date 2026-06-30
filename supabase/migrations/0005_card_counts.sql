-- Per-team card tallies from the live feed (verifiable counts; not per-player).
alter table public.matches add column if not exists home_yellow integer not null default 0;
alter table public.matches add column if not exists home_red    integer not null default 0;
alter table public.matches add column if not exists away_yellow integer not null default 0;
alter table public.matches add column if not exists away_red    integer not null default 0;
