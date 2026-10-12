-- Creator Hub Creator Network — 0018 Teams schema convergence.
-- Forward-only, additive repair for deployments whose public.teams table predates
-- the complete Teams API contract. Review the read-only preflight first.
-- Requires the canonical base tables from migrations 0001, 0004, 0006 and 0008.
-- Does not create teams, users, a season, matches, results, or fabricated standings.

begin;

do $$
declare
  missing_core text[] := array[]::text[];
begin
  if to_regclass('public.profiles') is null then
    raise exception '0018 prerequisite missing: public.profiles. Review migration 0001_identity_social.sql.';
  end if;
  if to_regclass('public.teams') is null then
    raise exception '0018 prerequisite missing: public.teams. Review migration 0004_live_social_systems.sql.';
  end if;
  if to_regclass('public.team_members') is null then
    raise exception '0018 prerequisite missing: public.team_members. Review migration 0004_live_social_systems.sql.';
  end if;
  if to_regclass('public.leagues') is null then
    raise exception '0018 prerequisite missing: public.leagues. Review migration 0004_live_social_systems.sql and 0006_seed_config.sql.';
  end if;
  if to_regclass('public.league_seasons') is null or to_regclass('public.league_standings') is null then
    raise exception '0018 prerequisite missing: public.league_seasons or public.league_standings. Review migration 0008_server_authoritative_leagues.sql before this repair.';
  end if;
  if not exists (select 1 from public.leagues where code = 'D5') then
    raise exception '0018 prerequisite missing: division D5. Review migration 0016_official_division_tiers.sql.';
  end if;

  -- These columns identify real existing records and cannot safely be invented.
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='id') then
    missing_core := array_append(missing_core, 'teams.id');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='teams' and column_name='name') then
    missing_core := array_append(missing_core, 'teams.name');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='team_members' and column_name='team_id') then
    missing_core := array_append(missing_core, 'team_members.team_id');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='team_members' and column_name='user_id') then
    missing_core := array_append(missing_core, 'team_members.user_id');
  end if;
  if cardinality(missing_core) > 0 then
    raise exception '0018 cannot repair core identity columns automatically: %. Review the actual schema and restore the canonical base migration before continuing.', array_to_string(missing_core, ', ');
  end if;
end $$;

-- Expected fields queried by the current Teams API. The old numeric level is
-- retained only for legacy compatibility; division_code and league_standings
-- control competitive placement. The UI/API do not expose manual levels.
alter table public.teams
  add column if not exists description text not null default '',
  add column if not exists parish text,
  add column if not exists logo_url text,
  add column if not exists badge_url text,
  add column if not exists level integer not null default 1,
  add column if not exists points bigint not null default 0,
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists division_code text,
  add column if not exists max_members integer not null default 20,
  add column if not exists recruiting boolean not null default true;

alter table public.team_members
  add column if not exists role text not null default 'member',
  add column if not exists joined_at timestamptz not null default now();

-- Converge constraints/defaults even where an older version already had a column
-- but left it nullable or without a default. Preserve every non-null business value.
update public.teams set
  description=coalesce(description,''),
  points=coalesce(points,0),
  created_at=coalesce(created_at,now()),
  updated_at=coalesce(updated_at,created_at,now()),
  max_members=case when max_members is null or max_members < 2 then 20 when max_members > 500 then 500 else max_members end,
  recruiting=coalesce(recruiting,true);
alter table public.teams alter column description set default '';
alter table public.teams alter column description set not null;
alter table public.teams alter column points set default 0;
alter table public.teams alter column points set not null;
alter table public.teams alter column created_at set default now();
alter table public.teams alter column created_at set not null;
alter table public.teams alter column updated_at set default now();
alter table public.teams alter column updated_at set not null;
alter table public.teams alter column max_members set default 20;
alter table public.teams alter column max_members set not null;
alter table public.teams alter column recruiting set default true;
alter table public.teams alter column recruiting set not null;
update public.team_members set role=coalesce(role,'member'), joined_at=coalesce(joined_at,now());
alter table public.team_members alter column role set default 'member';
alter table public.team_members alter column role set not null;
alter table public.team_members alter column joined_at set default now();
alter table public.team_members alter column joined_at set not null;

-- Never permit a legacy, null or unknown value to become a competitive tier.
update public.teams t
   set division_code = 'D5'
 where t.division_code is null
    or t.division_code <> all (array[
      'A1','A2','A3','B1','B2','B3','B4','B5',
      'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'
    ]::text[])
    or not exists (select 1 from public.leagues l where l.code = t.division_code);

alter table public.teams alter column division_code set default 'D5';
alter table public.teams alter column division_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'teams_division_code_fkey'
       and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_division_code_fkey
      foreign key (division_code) references public.leagues(code);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'teams_max_members_range_check'
       and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_max_members_range_check
      check (max_members between 2 and 500) not valid;
  end if;
end $$;

-- Repair missing standings columns without resetting existing scores/results.
alter table public.league_standings
  add column if not exists played integer not null default 0,
  add column if not exists wins integer not null default 0,
  add column if not exists draws integer not null default 0,
  add column if not exists losses integer not null default 0,
  add column if not exists goals_for integer not null default 0,
  add column if not exists goals_against integer not null default 0,
  add column if not exists points integer not null default 0,
  add column if not exists form jsonb not null default '[]'::jsonb,
  add column if not exists position integer,
  add column if not exists promoted boolean not null default false,
  add column if not exists relegated boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.league_standings set
  played=coalesce(played,0), wins=coalesce(wins,0), draws=coalesce(draws,0),
  losses=coalesce(losses,0), goals_for=coalesce(goals_for,0), goals_against=coalesce(goals_against,0),
  points=coalesce(points,0), form=coalesce(form,'[]'::jsonb), promoted=coalesce(promoted,false),
  relegated=coalesce(relegated,false), updated_at=coalesce(updated_at,now());
alter table public.league_standings alter column played set default 0;
alter table public.league_standings alter column played set not null;
alter table public.league_standings alter column wins set default 0;
alter table public.league_standings alter column wins set not null;
alter table public.league_standings alter column draws set default 0;
alter table public.league_standings alter column draws set not null;
alter table public.league_standings alter column losses set default 0;
alter table public.league_standings alter column losses set not null;
alter table public.league_standings alter column goals_for set default 0;
alter table public.league_standings alter column goals_for set not null;
alter table public.league_standings alter column goals_against set default 0;
alter table public.league_standings alter column goals_against set not null;
alter table public.league_standings alter column points set default 0;
alter table public.league_standings alter column points set not null;
alter table public.league_standings alter column form set default '[]'::jsonb;
alter table public.league_standings alter column form set not null;
alter table public.league_standings alter column promoted set default false;
alter table public.league_standings alter column promoted set not null;
alter table public.league_standings alter column relegated set default false;
alter table public.league_standings alter column relegated set not null;
alter table public.league_standings alter column updated_at set default now();
alter table public.league_standings alter column updated_at set not null;

create index if not exists teams_points_division_idx
  on public.teams(division_code, points desc);
create index if not exists team_members_user_idx
  on public.team_members(user_id, team_id);
create index if not exists team_members_joined_idx
  on public.team_members(team_id, joined_at);
create index if not exists league_standings_division_idx
  on public.league_standings(season_id, division_code, points desc, position);

-- Existing owners are real rows; fill only a missing membership relationship.
insert into public.team_members(team_id, user_id, role, joined_at)
select t.id, t.owner_id, 'owner', coalesce(t.created_at, now())
  from public.teams t
 where t.owner_id is not null
on conflict (team_id, user_id) do nothing;

-- Preserve existing standings. Add missing rows for already-active seasons only.
insert into public.league_standings(season_id, team_id, division_code)
select s.id, t.id,
       case when t.division_code = any (array[
         'A1','A2','A3','B1','B2','B3','B4','B5',
         'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'
       ]::text[]) and exists (select 1 from public.leagues l where l.code=t.division_code)
       then t.division_code else 'D5' end
  from public.league_seasons s
 cross join public.teams t
 where s.status = 'active'
on conflict (season_id, team_id) do nothing;

-- Keep team-to-active-season enrollment working even if migration 0017 was
-- omitted from a manually maintained migration history.
create or replace function public.add_new_team_to_active_league_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_season_id uuid;
  target_division text;
begin
  select id into active_season_id
    from public.league_seasons
   where status = 'active'
   order by created_at desc
   limit 1;

  if active_season_id is not null then
    if new.division_code = any (array[
      'A1','A2','A3','B1','B2','B3','B4','B5',
      'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'
    ]::text[]) and exists (select 1 from public.leagues l where l.code=new.division_code) then
      target_division := new.division_code;
    else
      target_division := 'D5';
    end if;
    insert into public.league_standings(season_id, team_id, division_code)
    values (active_season_id, new.id, target_division)
    on conflict (season_id, team_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_add_to_active_league_season on public.teams;
create trigger teams_add_to_active_league_season
  after insert on public.teams
  for each row execute function public.add_new_team_to_active_league_season();

notify pgrst, 'reload schema';
commit;
