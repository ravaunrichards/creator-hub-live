-- Creator Hub Creator Network — 0017 Teams schema compatibility repair.
-- ADDITIVE ONLY. Run after 0004, 0008 and 0016 have been reviewed/applied.
-- Does not create teams/seasons or alter existing team level/points/results. It repairs
-- standings for any already-active season and keeps newly-created teams enrolled.
begin;

do $$
begin
  if to_regclass('public.teams') is null then raise exception 'Cannot repair Teams schema: public.teams is missing; review migration 0004_live_social_systems.sql first'; end if;
  if to_regclass('public.team_members') is null then raise exception 'Cannot repair Teams schema: public.team_members is missing; review migration 0004_live_social_systems.sql first'; end if;
  if to_regclass('public.leagues') is null then raise exception 'Cannot repair Teams schema: public.leagues is missing; review migration 0004_live_social_systems.sql first'; end if;
  if to_regclass('public.league_seasons') is null then raise exception 'Cannot repair Teams schema: public.league_seasons is missing; review migration 0008_server_authoritative_leagues.sql first'; end if;
  if to_regclass('public.league_standings') is null then raise exception 'Cannot repair Teams schema: public.league_standings is missing; review migration 0008_server_authoritative_leagues.sql first'; end if;
  if not exists (select 1 from public.leagues where code='D5') then raise exception 'Cannot repair Teams schema: division D5 is missing; review migrations 0006_seed_config.sql and 0016_official_division_tiers.sql'; end if;
end $$;

alter table public.teams
  add column if not exists description text not null default '',
  add column if not exists parish text,
  add column if not exists recruiting boolean not null default true,
  add column if not exists max_members integer not null default 20,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists division_code text;

update public.teams set division_code='D5' where division_code is null;

-- The old standalone 'A' code and any stale/unknown value are not competitive
-- divisions. Normalize them before enforcing the official division foreign key.
update public.teams t
   set division_code='D5'
 where not exists (
   select 1 from public.leagues l
    where l.code=t.division_code
      and l.code = any (array[
        'A1','A2','A3','B1','B2','B3','B4','B5',
        'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'
      ]::text[])
 );

alter table public.teams alter column division_code set default 'D5';
alter table public.teams alter column division_code set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='teams_division_code_fkey' and conrelid='public.teams'::regclass) then
    alter table public.teams add constraint teams_division_code_fkey foreign key (division_code) references public.leagues(code);
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_max_members_range_check' and conrelid='public.teams'::regclass) then
    alter table public.teams add constraint teams_max_members_range_check check (max_members between 2 and 500) not valid;
  end if;
end $$;

alter table public.team_members
  add column if not exists role text not null default 'member',
  add column if not exists joined_at timestamptz not null default now();

create index if not exists teams_points_division_idx on public.teams(division_code, points desc);
create index if not exists team_members_user_idx on public.team_members(user_id, team_id);
create index if not exists team_members_joined_idx on public.team_members(team_id, joined_at);

-- If a season is already active, backfill missing standings for real existing teams.
-- Existing results/standings are preserved by ON CONFLICT DO NOTHING.
insert into public.league_standings(season_id, team_id, division_code)
select s.id, t.id,
       case when t.division_code = any (array[
                    'A1','A2','A3','B1','B2','B3','B4','B5',
                    'C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'
                  ]::text[])
                  and exists (select 1 from public.leagues l where l.code = t.division_code)
            then t.division_code else 'D5' end
from public.league_seasons s
cross join public.teams t
where s.status = 'active'
on conflict (season_id, team_id) do nothing;

-- A team created after the season starts must be included in that active season.
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
       ]::text[])
       and exists (select 1 from public.leagues l where l.code = new.division_code) then
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

-- Ask PostgREST to refresh its schema cache after the transaction completes.
notify pgrst, 'reload schema';

commit;
