-- Per-match snapshot of the last-seen TxLINE stat values, so the engine can
-- detect deltas (a new goal/corner/card) between ticks and emit match_events.
alter table public.matches add column if not exists stat_snapshot jsonb not null default '{}'::jsonb;
