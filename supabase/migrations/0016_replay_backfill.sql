alter table public.matches add column if not exists replay_built boolean not null default false;
