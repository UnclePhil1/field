create table if not exists public.squads (
  id          uuid primary key default gen_random_uuid(),
  match_id    text not null references public.matches(id) on delete cascade,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);
create index if not exists squads_match_idx on public.squads(match_id);
create index if not exists squads_owner_idx on public.squads(owner_id);

create table if not exists public.squad_members (
  squad_id  uuid not null references public.squads(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

alter table public.squads         enable row level security;
alter table public.squad_members  enable row level security;

drop policy if exists squads_read on public.squads;
create policy squads_read on public.squads for select using (true);

drop policy if exists squad_members_read on public.squad_members;
create policy squad_members_read on public.squad_members for select using (true);
