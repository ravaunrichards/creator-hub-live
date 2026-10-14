-- Creator Hub Creator Network: TikTok creator round-robin leagues
-- Add as database/migrations/0014_creator_league_server.sql
-- Apply only after taking a Supabase backup and reviewing this migration.
-- No sample users, leagues, registrations, fixtures, payments, or scores are seeded.

create table if not exists public.creator_leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) between 3 and 100),
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft','registration_open','registration_closed','active','completed','cancelled')),
  entry_fee numeric(12,2) not null default 0 check (entry_fee >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  max_participants integer not null default 20 check (max_participants between 2 and 500),
  win_points integer not null default 3 check (win_points between 0 and 100),
  draw_points integer not null default 1 check (draw_points between 0 and 100),
  loss_points integer not null default 0 check (loss_points between 0 and 100),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists creator_leagues_status_idx
  on public.creator_leagues(status, starts_at);

create table if not exists public.creator_league_admins (
  league_id uuid not null references public.creator_leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','scorer','moderator')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (league_id,user_id)
);
create index if not exists creator_league_admins_user_idx
  on public.creator_league_admins(user_id, league_id);

create table if not exists public.creator_league_registrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.creator_leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','registered','withdrawn','disqualified')),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id,user_id)
);
create index if not exists creator_league_registrations_status_idx
  on public.creator_league_registrations(league_id,status,registered_at);

create table if not exists public.creator_league_fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.creator_leagues(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  home_user_id uuid not null references public.profiles(id) on delete restrict,
  away_user_id uuid not null references public.profiles(id) on delete restrict,
  scheduled_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','live','completed','cancelled')),
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  result_recorded_by uuid references public.profiles(id) on delete set null,
  result_recorded_at timestamptz,
  created_at timestamptz not null default now(),
  check (home_user_id <> away_user_id),
  unique (league_id,round_number,home_user_id,away_user_id)
);
create index if not exists creator_league_fixtures_order_idx
  on public.creator_league_fixtures(league_id,round_number,status);

create table if not exists public.creator_league_score_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.creator_leagues(id) on delete cascade,
  fixture_id uuid not null references public.creator_league_fixtures(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('result_recorded','result_corrected','fixture_cancelled')),
  old_home_score integer,
  old_away_score integer,
  new_home_score integer,
  new_away_score integer,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists creator_league_score_events_fixture_idx
  on public.creator_league_score_events(fixture_id,created_at desc);

create table if not exists public.creator_league_payments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.creator_leagues(id) on delete restrict,
  registration_id uuid not null references public.creator_league_registrations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'paypal' check (provider in ('paypal')),
  provider_order_id text unique not null,
  provider_capture_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created'
    check (status in ('created','pending','completed','failed','refunded')),
  verified_at timestamptz,
  raw_order jsonb,
  raw_capture jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creator_league_payments_user_idx
  on public.creator_league_payments(user_id,created_at desc);

-- Service-role backend is the only writer. Client/browser writes are not allowed.
alter table public.creator_leagues enable row level security;
alter table public.creator_league_admins enable row level security;
alter table public.creator_league_registrations enable row level security;
alter table public.creator_league_fixtures enable row level security;
alter table public.creator_league_score_events enable row level security;
alter table public.creator_league_payments enable row level security;

drop policy if exists creator_leagues_public_read on public.creator_leagues;
create policy creator_leagues_public_read on public.creator_leagues
  for select to anon, authenticated using (status <> 'draft');
drop policy if exists creator_league_admins_self_read on public.creator_league_admins;
create policy creator_league_admins_self_read on public.creator_league_admins
  for select to authenticated using (user_id = auth.uid());
drop policy if exists creator_league_registrations_self_read on public.creator_league_registrations;
create policy creator_league_registrations_self_read on public.creator_league_registrations
  for select to authenticated using (user_id = auth.uid());
drop policy if exists creator_league_fixtures_public_read on public.creator_league_fixtures;
create policy creator_league_fixtures_public_read on public.creator_league_fixtures
  for select to anon, authenticated using (
    exists (select 1 from public.creator_leagues l where l.id=league_id and l.status <> 'draft')
  );
drop policy if exists creator_league_score_events_public_read on public.creator_league_score_events;
create policy creator_league_score_events_public_read on public.creator_league_score_events
  for select to anon, authenticated using (
    exists (select 1 from public.creator_leagues l where l.id=league_id and l.status <> 'draft')
  );
drop policy if exists creator_league_payments_self_read on public.creator_league_payments;
create policy creator_league_payments_self_read on public.creator_league_payments
  for select to authenticated using (user_id = auth.uid());

-- Explicitly remove browser write access if similarly named policies were added before.
drop policy if exists creator_leagues_client_insert on public.creator_leagues;
drop policy if exists creator_leagues_client_update on public.creator_leagues;
drop policy if exists creator_league_admins_client_write on public.creator_league_admins;
drop policy if exists creator_league_registrations_client_write on public.creator_league_registrations;
drop policy if exists creator_league_fixtures_client_write on public.creator_league_fixtures;
drop policy if exists creator_league_score_events_client_write on public.creator_league_score_events;
drop policy if exists creator_league_payments_client_write on public.creator_league_payments;

-- The application must use the existing server's service-role db() client for writes.
-- Do not expose SUPABASE_SERVICE_ROLE_KEY to frontend code.


-- Atomic score update + audit event. Called only by the backend service-role client.
create or replace function public.record_creator_league_score(
  p_league_id uuid,
  p_fixture_id uuid,
  p_actor_id uuid,
  p_home_score integer,
  p_away_score integer,
  p_note text default ''
)
returns public.creator_league_fixtures
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.creator_league_fixtures;
  was_completed boolean;
  old_home integer;
  old_away integer;
begin
  if p_home_score is null or p_away_score is null
     or p_home_score < 0 or p_away_score < 0
     or p_home_score > 1000000 or p_away_score > 1000000 then
    raise exception 'INVALID_SCORE';
  end if;

  select * into f
  from public.creator_league_fixtures
  where id = p_fixture_id and league_id = p_league_id
  for update;

  if not found then raise exception 'FIXTURE_NOT_FOUND'; end if;
  if f.status = 'cancelled' then raise exception 'FIXTURE_CANCELLED'; end if;
  was_completed := f.status = 'completed';
  old_home := f.home_score;
  old_away := f.away_score;

  update public.creator_league_fixtures
  set home_score = p_home_score,
      away_score = p_away_score,
      status = 'completed',
      result_recorded_by = p_actor_id,
      result_recorded_at = now()
  where id = p_fixture_id
  returning * into f;

  insert into public.creator_league_score_events(
    league_id, fixture_id, actor_id, event_type,
    old_home_score, old_away_score, new_home_score, new_away_score, note
  ) values (
    p_league_id, p_fixture_id, p_actor_id,
    case when was_completed then 'result_corrected' else 'result_recorded' end,
    case when was_completed then old_home else null end,
    case when was_completed then old_away else null end,
    p_home_score, p_away_score, left(coalesce(p_note,''),500)
  );

  return f;
end;
$$;
revoke all on function public.record_creator_league_score(uuid,uuid,uuid,integer,integer,text) from public, anon, authenticated;
