-- =====================================================================
-- Creator Hub Live \u2014 0004 LIVE, guests, matches, taps, teams, leagues,
-- rankings, subscriptions, admin audit, referrals, sounds, hashtags
-- =====================================================================

-- LIVE sessions ---------------------------------------------------------
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  room_name text unique not null,       -- LiveKit room
  title text not null default '',
  category text,
  kind text not null default 'video' check (kind in ('video','voice','screen','game')),
  country text, region text, language text,
  status text not null default 'live' check (status in ('live','ended')),
  max_guests int not null default 12 check (max_guests between 0 and 12),
  viewer_count int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_status_idx on public.live_sessions(status, started_at desc);

-- Guests: host(1) + up to 12 guests = 13 participants max.
create table if not exists public.live_guests (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','accepted','rejected','removed','left')),
  slot int,
  mic_on boolean not null default true,
  cam_on boolean not null default true,
  pinned boolean not null default false,
  joined_at timestamptz,
  unique (live_id, user_id)
);

-- Enforce the 12-guest cap at the database level.
create or replace function public.enforce_guest_cap()
returns trigger language plpgsql as $$
declare active_guests int; cap int;
begin
  if new.status = 'accepted' then
    select max_guests into cap from public.live_sessions where id = new.live_id;
    select count(*) into active_guests from public.live_guests
      where live_id = new.live_id and status = 'accepted' and id <> new.id;
    if active_guests >= cap then raise exception 'guest cap reached (max % guests)', cap; end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guest_cap on public.live_guests;
create trigger trg_guest_cap before insert or update on public.live_guests
  for each row execute function public.enforce_guest_cap();

-- Matches + tap-to-point ----------------------------------------------
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  live_id uuid references public.live_sessions(id) on delete set null,
  mode text not null default '1v1',
  status text not null default 'active' check (status in ('active','ended')),
  started_at timestamptz not null default now(),
  ends_at timestamptz
);
create table if not exists public.match_participants (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team text,
  points bigint not null default 0,
  primary key (match_id, user_id)
);
create table if not exists public.taps (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  points int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists taps_rate_idx on public.taps(user_id, created_at);

-- Server-validated, rate-limited tap. Rejects >10 taps/user/second.
create or replace function public.register_tap(p_user uuid, p_match uuid, p_target uuid, p_points int default 1)
returns public.match_participants language plpgsql security definer set search_path = public as $$
declare recent int; mp public.match_participants;
begin
  if p_points < 1 or p_points > 1 then raise exception 'invalid tap weight'; end if;
  select count(*) into recent from public.taps
    where user_id = p_user and created_at > now() - interval '1 second';
  if recent >= 10 then raise exception 'rate limited'; end if;
  if not exists (select 1 from public.matches where id = p_match and status = 'active') then
    raise exception 'match not active'; end if;
  insert into public.taps(match_id,user_id,target_id,points) values (p_match,p_user,p_target,p_points);
  update public.match_participants set points = points + p_points
    where match_id = p_match and user_id = p_target returning * into mp;
  return mp;
end; $$;

-- Teams / leagues ------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  logo_url text, badge_url text,
  level int not null default 1 check (level between 1 and 50),
  points bigint not null default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  primary key (team_id, user_id)
);
create table if not exists public.leagues (
  code text primary key,     -- A,A1..A3,B1..B5,C1..C5,D1..D5
  tier text not null,
  rank int not null
);

-- Subscriptions --------------------------------------------------------
create table if not exists public.subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, price numeric(18,2) not null, currency text not null default 'USD',
  badge text, emoji text, perks jsonb not null default '[]'::jsonb, active boolean not null default true
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.subscription_tiers(id) on delete cascade,
  subscriber_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  current_period_end timestamptz,
  provider_ref text,
  created_at timestamptz not null default now(),
  unique (tier_id, subscriber_id)
);

-- Referrals ------------------------------------------------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  code text unique not null,
  referred_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Sounds + hashtag registry -------------------------------------------
create table if not exists public.sounds (
  id uuid primary key default gen_random_uuid(),
  title text not null, author_id uuid references public.profiles(id) on delete set null,
  url text, uses int not null default 0
);

-- Admin audit ----------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null, target text, detail jsonb, created_at timestamptz not null default now()
);

-- Reports / moderation -------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null, target_id text not null, reason text,
  status text not null default 'open', created_at timestamptz not null default now()
);
