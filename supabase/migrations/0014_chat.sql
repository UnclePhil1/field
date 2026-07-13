create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null check (scope in ('match', 'squad')),
  scope_id   text not null,      -- match id, or squad invite_code
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,      -- display name captured at send time
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_scope_idx on public.chat_messages(scope_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists chat_read on public.chat_messages;
create policy chat_read on public.chat_messages for select using (
  scope = 'match'
  or (scope = 'squad' and exists (
    select 1 from public.squads s
    join public.squad_members sm on sm.squad_id = s.id
    where s.invite_code = chat_messages.scope_id and sm.user_id = auth.uid()
  ))
);

do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end $$;

create table if not exists public.chat_reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (message_id, reporter_id)
);
alter table public.chat_reports enable row level security;
