-- Lineups, player attribution, and live possession/momentum from the TxLINE feed.

-- Parsed starting XI + bench per team, plus per-player aggregate stats, cached
-- once the feed publishes them (not available until kickoff). Shape:
--   { home: { team, players: [{ id, name, number, starter, position, goals, yellow, red }] },
--     away: { ... }, publishedAt }
alter table public.matches add column if not exists lineups jsonb;

-- Live possession snapshot from the feed (null = not yet reported).
alter table public.matches add column if not exists possession integer;      -- home possession %
alter table public.matches add column if not exists possession_type text;     -- Safe | Attack | Danger | HighDanger

-- The player the feed attributes an event to (e.g. the scorer / booked player).
alter table public.match_events add column if not exists player text;

-- The player whose action resolved a settled pool (for the receipt + notification).
alter table public.prediction_cards add column if not exists resolved_player text;
