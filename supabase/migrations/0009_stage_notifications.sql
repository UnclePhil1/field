-- Match stage label (Group / R16 / QF …) + in-app notification inbox.

alter table public.matches add column if not exists stage text;

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  url        text,
  kind       text not null default 'general',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

-- users see + update (mark read) only their own; inserts come from the service role
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select using (auth.uid() = user_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;
