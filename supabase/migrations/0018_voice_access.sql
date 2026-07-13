create table if not exists public.voice_access (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  trials_used    int not null default 0,
  sub_expires_at timestamptz,
  sub_tx_sig     text,
  updated_at     timestamptz not null default now()
);

alter table public.voice_access enable row level security;
drop policy if exists voice_access_read_own on public.voice_access;
create policy voice_access_read_own on public.voice_access for select using (auth.uid() = user_id);
