-- Staged pre-match reminders. pre_stage tracks how many of the reminder windows
-- (60m, 30m, 10m, 5m, 1m before kickoff) have already been sent for a match.
alter table public.matches add column if not exists pre_stage int not null default 0;
