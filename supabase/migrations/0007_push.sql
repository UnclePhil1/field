create table if not exists public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  token        text not null unique,
  platform     text not null default 'web',      -- 'web' now; 'android'/'ios'/'expo' later
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

create table if not exists public.notification_preferences (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  enabled      boolean not null default true,
  match_events jsonb not null default '{"goals":true,"cards":true,"corners":true,"phases":true}',
  my_play      jsonb not null default '{"card_locking":true,"settled":true,"streak_risk":true,"new_card":false}',
  tournaments  jsonb not null default '{"results":true,"payout":true,"paid":true}',
  followed     jsonb not null default '[]',       -- match/team ids to alert on
  updated_at   timestamptz not null default now()
);

alter table public.push_tokens             enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists notif_prefs_read_own on public.notification_preferences;
create policy notif_prefs_read_own on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists notif_prefs_write_own on public.notification_preferences;
create policy notif_prefs_write_own on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
