-- Creator Hub Live 0008: Server-Authoritative Competitive Leagues (Full Working Script)
-- Active competition order: A1 (highest) -> A2 -> A3 -> B1..B5 -> C1..C5 -> D1..D5 (lowest).

-- 1. Base / Dependency Tables (created if not exists for standalone execution)
create table if not exists public.leagues (
    code text primary key,
    name text not null,
    tier int not null,
    created_at timestamptz not null default now()
);

-- Seed all active division codes (A1 to D5)
insert into public.leagues (code, name, tier) values
    ('A1', 'Division A1', 1), ('A2', 'Division A2', 1), ('A3', 'Division A3', 1),
    ('B1', 'Division B1', 2), ('B2', 'Division B2', 2), ('B3', 'Division B3', 2), ('B4', 'Division B4', 2), ('B5', 'Division B5', 2),
    ('C1', 'Division C1', 3), ('C2', 'Division C2', 3), ('C3', 'Division C3', 3), ('C4', 'Division C4', 3), ('C5', 'Division C5', 3),
    ('D1', 'Division D1', 4), ('D2', 'Division D2', 4), ('D3', 'Division D3', 4), ('D4', 'Division D4', 4), ('D5', 'Division D5', 4)
on conflict (code) do nothing;

create table if not exists public.profiles (
    id uuid primary key default gen_random_uuid(),
    username text,
    created_at timestamptz not null default now()
);

create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    division_code text default 'D5' references public.leagues(code),
    created_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
    id uuid primary key default gen_random_uuid(),
    title text,
    status text not null default 'pending' check (status in ('pending','live','ended')),
    created_at timestamptz not null default now()
);

-- 2. League Seasons & Core Structure
create table if not exists public.league_seasons (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    status text not null default 'scheduled' check (status in ('scheduled','active','finalizing','completed')),
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (ends_at > starts_at)
);
create unique index if not exists league_seasons_one_active on public.league_seasons(status) where status='active';

-- 3. Team Division Code Constraints & Updates
alter table public.teams add column if not exists division_code text;
update public.teams set division_code='D5' where division_code is null;
alter table public.teams drop constraint if exists teams_division_code_fkey;
alter table public.teams add constraint teams_division_code_fkey foreign key (division_code) references public.leagues(code);
alter table public.teams alter column division_code set default 'D5';
alter table public.teams alter column division_code set not null;

-- 4. Standings, Matches, and Events
create table if not exists public.league_standings (
    season_id uuid not null references public.league_seasons(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    division_code text not null references public.leagues(code),
    played int not null default 0 check (played >= 0),
    wins int not null default 0 check (wins >= 0),
    draws int not null default 0 check (draws >= 0),
    losses int not null default 0 check (losses >= 0),
    goals_for int not null default 0 check (goals_for >= 0),
    goals_against int not null default 0 check (goals_against >= 0),
    points int not null default 0 check (points >= 0),
    form jsonb not null default '[]'::jsonb,
    position int,
    promoted boolean not null default false,
    relegated boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (season_id, team_id)
);
create index if not exists league_standings_division_idx on public.league_standings(season_id, division_code, points desc, position);

create table if not exists public.league_matches (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references public.league_seasons(id) on delete cascade,
    division_code text not null references public.leagues(code),
    home_team_id uuid not null references public.teams(id),
    away_team_id uuid not null references public.teams(id),
    status text not null default 'scheduled' check (status in ('scheduled','live','completed','cancelled')),
    home_score int check (home_score is null or home_score >= 0),
    away_score int check (away_score is null or away_score >= 0),
    played_at timestamptz,
    created_at timestamptz not null default now(),
    check (home_team_id <> away_team_id)
);
create index if not exists league_matches_season_idx on public.league_matches(season_id, division_code, status, created_at desc);

create table if not exists public.league_events (
    id uuid primary key default gen_random_uuid(),
    season_id uuid references public.league_seasons(id) on delete cascade,
    match_id uuid references public.league_matches(id) on delete set null,
    event_type text not null,
    actor_id uuid references public.profiles(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- 5. Live Room Lifecycle Constraints
alter table public.live_sessions drop constraint if exists live_sessions_status_check;
alter table public.live_sessions add constraint live_sessions_status_check check (status in ('pending','live','ended'));

-- 6. Row Level Security (RLS) Configuration
alter table public.league_seasons enable row level security;
alter table public.league_standings enable row level security;
alter table public.league_matches enable row level security;
alter table public.league_events enable row level security;
alter table public.teams enable row level security;
alter table public.live_sessions enable row level security;
alter table public.leagues enable row level security;

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select using (true);

drop policy if exists live_read on public.live_sessions;
create policy live_read on public.live_sessions for select using (true);

drop policy if exists leagues_read on public.leagues;
create policy leagues_read on public.leagues for select using (true);

drop policy if exists league_seasons_read on public.league_seasons;
create policy league_seasons_read on public.league_seasons for select using (true);

drop policy if exists league_standings_read on public.league_standings;
create policy league_standings_read on public.league_standings for select using (true);

drop policy if exists league_matches_read on public.league_matches;
create policy league_matches_read on public.league_matches for select using (true);

drop policy if exists league_events_read on public.league_events;
create policy league_events_read on public.league_events for select using (true);

-- Explicitly remove any client write policies
drop policy if exists league_standings_insert on public.league_standings;
drop policy if exists league_standings_update on public.league_standings;
drop policy if exists league_standings_delete on public.league_standings;
drop policy if exists league_matches_insert on public.league_matches;
drop policy if exists league_matches_update on public.league_matches;
drop policy if exists league_matches_delete on public.league_matches;
drop policy if exists league_events_insert on public.league_events;
drop policy if exists league_events_update on public.league_events;
drop policy if exists league_events_delete on public.league_events;

-- 7. Authoritative Stored Functions
create or replace function public.initialize_league_season(p_season uuid)
returns void language plpgsql security definer set search_path=public as $$
declare t record; code text;
begin
    if not exists(select 1 from league_seasons where id=p_season and status in ('scheduled','active')) then raise exception 'season not found or closed'; end if;
    for t in select id, division_code from teams loop
        code := case when exists(select 1 from leagues where code=t.division_code and code <> 'A') then t.division_code else 'D5' end;
        insert into league_standings(season_id,team_id,division_code) values(p_season,t.id,code)
            on conflict (season_id,team_id) do update set division_code=excluded.division_code;
    end loop;
end; $$;

create or replace function public.rebuild_league_positions(p_season uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
    with ranked as (
        select season_id, team_id, row_number() over(partition by season_id,division_code order by points desc,(goals_for-goals_against) desc,goals_for desc,team_id) rn
        from league_standings where season_id=p_season
    )
    update league_standings s set position=r.rn, updated_at=now() from ranked r where s.season_id=r.season_id and s.team_id=r.team_id;
end; $$;

create or replace function public.rebuild_league_standings(p_season uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
    update league_standings set played=0,wins=0,draws=0,losses=0,goals_for=0,goals_against=0,points=0,form='[]'::jsonb,position=null,promoted=false,relegated=false,updated_at=now() where season_id=p_season;
    with outcomes as (
        select season_id, division_code, home_team_id team_id, 1 played,
               case when home_score>away_score then 1 else 0 end wins,
               case when home_score=away_score then 1 else 0 end draws,
               case when home_score<away_score then 1 else 0 end losses,
               home_score goals_for, away_score goals_against,
               case when home_score>away_score then 3 when home_score=away_score then 1 else 0 end points
          from league_matches where season_id=p_season and status='completed' and home_score is not null and away_score is not null
        union all
        select season_id, division_code, away_team_id team_id, 1,
               case when away_score>home_score then 1 else 0 end,
               case when away_score=home_score then 1 else 0 end,
               case when away_score<home_score then 1 else 0 end,
               away_score, home_score,
               case when away_score>home_score then 3 when away_score=home_score then 1 else 0 end
          from league_matches where season_id=p_season and status='completed' and home_score is not null and away_score is not null
    ), agg as (
        select season_id,team_id,max(division_code) division_code,sum(played) played,sum(wins) wins,sum(draws) draws,sum(losses) losses,sum(goals_for) goals_for,sum(goals_against) goals_against,sum(points) points
          from outcomes group by season_id,team_id
    )
    update league_standings s set division_code=coalesce(a.division_code,s.division_code),played=coalesce(a.played,0),wins=coalesce(a.wins,0),draws=coalesce(a.draws,0),losses=coalesce(a.losses,0),goals_for=coalesce(a.goals_for,0),goals_against=coalesce(a.goals_against,0),points=coalesce(a.points,0),updated_at=now()
        from agg a where s.season_id=a.season_id and s.team_id=a.team_id;
    perform rebuild_league_positions(p_season);
end; $$;

create or replace function public.record_league_match_result(p_match uuid,p_home_score int,p_away_score int,p_actor uuid)
returns public.league_matches language plpgsql security definer set search_path=public as $$
declare m league_matches; hs uuid; asid uuid;
begin
    if p_home_score < 0 or p_away_score < 0 then raise exception 'INVALID_SCORE'; end if;
    select * into m from league_matches where id=p_match for update;
    if not found then raise exception 'INVALID_MATCH'; end if;
    if m.status='completed' then raise exception 'RESULT_ALREADY_FINAL'; end if;
    if m.status not in ('scheduled','live') then raise exception 'INVALID_MATCH'; end if;
    select team_id into hs from league_standings where season_id=m.season_id and team_id=m.home_team_id for update;
    if hs is null then raise exception 'INVALID_MATCH: home team is not initialized'; end if;
    select team_id into asid from league_standings where season_id=m.season_id and team_id=m.away_team_id for update;
    if asid is null then raise exception 'INVALID_MATCH: away team is not initialized'; end if;
    update league_matches set status='completed',home_score=p_home_score,away_score=p_away_score,played_at=now() where id=p_match returning * into m;
    insert into league_events(season_id,match_id,event_type,actor_id,payload) values(m.season_id,m.id,'match_completed',p_actor,jsonb_build_object('home_score',p_home_score,'away_score',p_away_score));
    perform rebuild_league_standings(m.season_id);
    return m;
end; $$;

create or replace function public.correct_league_match_result(p_match uuid,p_home_score int,p_away_score int,p_actor uuid)
returns public.league_matches language plpgsql security definer set search_path=public as $$
declare m league_matches;
begin
    if p_home_score < 0 or p_away_score < 0 then raise exception 'INVALID_SCORE'; end if;
    select * into m from league_matches where id=p_match for update;
    if not found then raise exception 'INVALID_MATCH'; end if;
    if m.status <> 'completed' then raise exception 'RESULT_ALREADY_FINAL'; end if;
    update league_matches set home_score=p_home_score,away_score=p_away_score,played_at=coalesce(played_at,now()) where id=p_match returning * into m;
    insert into league_events(season_id,match_id,event_type,actor_id,payload) values(m.season_id,m.id,'match_corrected',p_actor,jsonb_build_object('home_score',p_home_score,'away_score',p_away_score));
    perform rebuild_league_standings(m.season_id);
    return m;
end; $$;

create or replace function public.finalize_league_season(p_season uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s record; target text;
begin
    update league_seasons set status='finalizing' where id=p_season and status='active';
    if not found then raise exception 'season is not active'; end if;
    perform rebuild_league_standings(p_season);
    update league_standings set promoted=false,relegated=false where season_id=p_season;

    -- Promote the top two in each active division except A1.
    for s in select * from league_standings where season_id=p_season and position <= 2 order by position loop
        target := case s.division_code
            when 'A2' then 'A1' when 'A3' then 'A2' when 'B1' then 'A3'
            when 'B2' then 'B1' when 'B3' then 'B2' when 'B4' then 'B3' when 'B5' then 'B4'
            when 'C1' then 'B5' when 'C2' then 'C1' when 'C3' then 'C2' when 'C4' then 'C3' when 'C5' then 'C4'
            when 'D1' then 'C5' when 'D2' then 'D1' when 'D3' then 'D2' when 'D4' then 'D3' when 'D5' then 'D4'
            else null end;
        if target is not null then
            update league_standings set promoted=true where season_id=p_season and team_id=s.team_id;
            update teams set division_code=target where id=s.team_id;
        end if;
    end loop;

    -- Relegate the bottom two in every active division except D5.
    with bottoms as (
        select season_id,team_id,division_code,row_number() over(partition by season_id,division_code order by position desc) rn
        from league_standings where season_id=p_season
    )
    select into s * from league_standings where false;
    for s in select b.* from bottoms b where b.rn <= 2 loop
        target := case s.division_code
            when 'A1' then 'A2' when 'A2' then 'A3' when 'A3' then 'B1'
            when 'B1' then 'B2' when 'B2' then 'B3' when 'B3' then 'B4' when 'B4' then 'B5'
            when 'B5' then 'C1' when 'C1' then 'C2' when 'C2' then 'C3' when 'C3' then 'C4' when 'C4' then 'C5'
            when 'C5' then 'D1' when 'D1' then 'D2' when 'D2' then 'D3' when 'D3' then 'D4' when 'D4' then 'D5'
            else null end;
        if target is not null then
            update league_standings set relegated=true where season_id=p_season and team_id=s.team_id;
            update teams set division_code=target where id=s.team_id;
        end if;
    end loop;
    update league_seasons set status='completed' where id=p_season;
end; $$;

-- 8. Security Revocations & Service Role Grants
revoke all on function public.initialize_league_season(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_league_positions(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_league_standings(uuid) from public, anon, authenticated;
revoke all on function public.record_league_match_result(uuid,int,int,uuid) from public, anon, authenticated;
revoke all on function public.correct_league_match_result(uuid,int,int,uuid) from public, anon, authenticated;
revoke all on function public.finalize_league_season(uuid) from public, anon, authenticated;

-- Grant execution rights to service_role for backend server orchestration
grant execute on function public.initialize_league_season(uuid) to service_role;
grant execute on function public.rebuild_league_positions(uuid) to service_role;
grant execute on function public.rebuild_league_standings(uuid) to service_role;
grant execute on function public.record_league_match_result(uuid,int,int,uuid) to service_role;
grant execute on function public.correct_league_match_result(uuid,int,int,uuid) to service_role;
grant execute on function public.finalize_league_season(uuid) to service_role;
