alter table public.matches add column if not exists stat_snapshot jsonb not null default '{}'::jsonb;
