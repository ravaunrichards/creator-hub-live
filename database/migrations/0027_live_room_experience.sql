-- Creator Hub Creator Network LIVE room experience upgrade (0026)
-- Manual install only. Back up Supabase first and review the whole migration.
-- Does not seed fake rooms, guests, votes, questions, metrics or gift transactions.

begin;

-- Optional per-gift sound asset URL. Existing rows stay unchanged unless an asset is configured.
alter table public.gifts add column if not exists sound_url text;

alter table public.live_sessions
  add column if not exists audience text not null default 'public',
  add column if not exists allow_guests boolean not null default true,
  add column if not exists cover_image_url text,
  add column if not exists updated_at timestamptz not null default now();

update public.live_sessions set audience='public' where audience is null;
update public.live_sessions set allow_guests=true where allow_guests is null;
alter table public.live_sessions alter column audience set default 'public';
alter table public.live_sessions alter column audience set not null;
alter table public.live_sessions alter column allow_guests set default true;
alter table public.live_sessions alter column allow_guests set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='live_sessions_audience_allowed' and conrelid='public.live_sessions'::regclass) then
    alter table public.live_sessions add constraint live_sessions_audience_allowed
      check (audience in ('public','followers','private'));
  end if;
  if not exists (select 1 from pg_constraint where conname='live_sessions_cover_https' and conrelid='public.live_sessions'::regclass) then
    alter table public.live_sessions add constraint live_sessions_cover_https
      check (cover_image_url is null or cover_image_url ~ '^https://');
  end if;
end $$;

create table if not exists public.live_room_moderators (
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (live_id, user_id)
);

create table if not exists public.live_room_polls (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'poll' check (kind in ('poll','qa')),
  question text not null check (length(trim(question)) between 1 and 220),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options)='array'),
  status text not null default 'active' check (status in ('active','closed')),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_room_polls_room_created_idx
  on public.live_room_polls(live_id, created_at desc);
create unique index if not exists live_room_polls_one_active_per_room
  on public.live_room_polls(live_id) where status='active';

create table if not exists public.live_room_poll_votes (
  poll_id uuid not null references public.live_room_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create table if not exists public.live_room_reactions (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('❤️','👏','🔥','🎉','😂','🇯🇲')),
  created_at timestamptz not null default now()
);
create index if not exists live_room_reactions_recent_idx
  on public.live_room_reactions(live_id, created_at desc);

create table if not exists public.live_room_questions (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 3 and 500),
  status text not null default 'open' check (status in ('open','answered')),
  pinned boolean not null default false,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_room_questions_room_order_idx
  on public.live_room_questions(live_id, pinned desc, created_at asc);

create table if not exists public.live_room_recordings (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  egress_id text unique,
  storage_key text not null,
  status text not null default 'processing' check (status in ('processing','recording','ready','failed','deleted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz,
  deleted_at timestamptz,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_room_recordings_room_created_idx
  on public.live_room_recordings(live_id, created_at desc);
create index if not exists live_room_recordings_retention_idx
  on public.live_room_recordings(status, expires_at) where status in ('ready','failed');

-- Enforce audience rules for direct Supabase reads too. The SECURITY DEFINER
-- helper avoids an RLS recursion between live_sessions and live_guests. It
-- returns only a boolean and never returns private session/member data.
create or replace function public.chcn_can_access_live_session(
  p_live_id uuid, p_host_id uuid, p_audience text, p_status text
) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce(
    p_host_id=auth.uid()
    or (p_status='live' and p_audience='public'
      and coalesce((select p.privacy->>'account' from public.profiles p where p.id=p_host_id),'public')='public')
    or (p_status='live' and auth.uid() is not null
      and (p_audience='followers' or (p_audience='public'
        and coalesce((select p.privacy->>'account' from public.profiles p where p.id=p_host_id),'public')='private'))
      and exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followee_id=p_host_id and f.status='accepted'))
    or (p_status='live' and auth.uid() is not null and (
      exists(select 1 from public.live_guests g where g.live_id=p_live_id and g.user_id=auth.uid() and g.status in ('invited','accepted'))
      or exists(select 1 from public.live_room_moderators m where m.live_id=p_live_id and m.user_id=auth.uid())
    )), false);
$$;
revoke all on function public.chcn_can_access_live_session(uuid,uuid,text,text) from public;
grant execute on function public.chcn_can_access_live_session(uuid,uuid,text,text) to anon, authenticated;

drop policy if exists live_read on public.live_sessions;
create policy live_read on public.live_sessions for select to anon, authenticated
  using (public.chcn_can_access_live_session(id,host_id,audience,status));
-- All room lifecycle writes are performed by the authenticated backend after it
-- verifies LiveKit publication. A host must not be able to set status=live via REST.
drop policy if exists live_write on public.live_sessions;
drop policy if exists live_update on public.live_sessions;
revoke insert, update, delete on public.live_sessions from anon, authenticated;

drop policy if exists guests_read on public.live_guests;
create policy guests_read on public.live_guests for select to authenticated using (
  user_id=auth.uid()
  or exists(select 1 from public.live_sessions s where s.id=live_id and s.host_id=auth.uid())
);
-- Invitation decisions, guest status and moderation fields are changed only by
-- the server routes; the previous guests_self policy let invitees self-accept via REST.
drop policy if exists guests_self on public.live_guests;
revoke insert, update, delete on public.live_guests from anon, authenticated;

-- Private-room chat cannot be read or written directly around backend audience checks.
drop policy if exists live_chat_read on public.live_chat_messages;
create policy live_chat_read on public.live_chat_messages for select to authenticated using (
  exists(select 1 from public.live_sessions s where s.id=live_id
    and public.chcn_can_access_live_session(s.id,s.host_id,s.audience,s.status))
);
drop policy if exists live_chat_insert on public.live_chat_messages;
create policy live_chat_insert on public.live_chat_messages for insert to authenticated with check (
  sender_id=auth.uid() and exists(select 1 from public.live_sessions s where s.id=live_id
    and s.status='live' and public.chcn_can_access_live_session(s.id,s.host_id,s.audience,s.status))
);
revoke update, delete on public.live_chat_messages from anon, authenticated;

-- The frontend must never write LIVE state or financial state directly.
-- These private tables are accessed only by the authenticated server/service role.
alter table public.live_room_moderators enable row level security;
alter table public.live_room_polls enable row level security;
alter table public.live_room_poll_votes enable row level security;
alter table public.live_room_reactions enable row level security;
alter table public.live_room_questions enable row level security;
alter table public.live_room_recordings enable row level security;
revoke all on public.live_room_moderators, public.live_room_polls,
  public.live_room_poll_votes, public.live_room_reactions, public.live_room_questions,
  public.live_room_recordings from anon, authenticated;
grant all on public.live_room_moderators, public.live_room_polls,
  public.live_room_poll_votes, public.live_room_reactions, public.live_room_questions,
  public.live_room_recordings to service_role;

-- Prompt PostgREST to refresh column/table metadata after this migration.
notify pgrst, 'reload schema';

commit;
