create table if not exists public.telegram_links (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  chat_id    text not null unique,
  tg_username text,
  linked_at  timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  code       text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists tg_link_codes_user_idx on public.telegram_link_codes(user_id);

alter table public.matches add column if not exists kickoff_notified boolean not null default false;
alter table public.matches add column if not exists ft_notified      boolean not null default false;
alter table public.matches add column if not exists pre_notified      boolean not null default false;

alter table public.telegram_links      enable row level security;
alter table public.telegram_link_codes enable row level security;

drop policy if exists tg_links_read_own on public.telegram_links;
create policy tg_links_read_own on public.telegram_links for select using (auth.uid() = user_id);
