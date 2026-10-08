-- Creator Hub Creator Network — LIVE room chat.
-- Chat is tied to an existing LIVE session; no synthetic messages are created.
create table if not exists public.live_chat_messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists live_chat_messages_room_idx
  on public.live_chat_messages(live_id, created_at desc);

alter table public.live_chat_messages enable row level security;

drop policy if exists live_chat_read on public.live_chat_messages;
create policy live_chat_read on public.live_chat_messages
  for select using (true);

drop policy if exists live_chat_insert on public.live_chat_messages;
create policy live_chat_insert on public.live_chat_messages
  for insert with check (sender_id = auth.uid());
