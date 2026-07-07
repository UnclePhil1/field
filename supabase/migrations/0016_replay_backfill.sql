-- Replay backfill flag. The live loop only records events it witnesses between
-- polls, so many finished matches have incomplete timelines. The engine rebuilds
-- the full timeline from the TxLINE historical feed and sets this once done.
alter table public.matches add column if not exists replay_built boolean not null default false;
