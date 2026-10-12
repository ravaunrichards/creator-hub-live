-- CREATOR HUB CREATOR NETWORK — Teams/league backend restart preflight.
-- READ ONLY. Run against the intended Supabase project before applying migrations.
-- Does not create tables, seed records, change divisions, or touch payment data.

-- Result 1: relation existence. A false row means the relation is absent from the
-- selected database, not merely absent from PostgREST's schema cache.
with expected(object_name, feature, migration_hint) as (
  values
    ('profiles', 'Identity and team-member profile lookup', '0001_identity_social.sql'),
    ('teams', 'Team profiles and API list/detail', '0004_live_social_systems.sql'),
    ('team_members', 'Team roster and membership', '0004_live_social_systems.sql'),
    ('leagues', 'Official division catalog', '0006_seed_config.sql; 0016_official_division_tiers.sql'),
    ('league_seasons', 'Active/scheduled team league seasons', '0008_server_authoritative_leagues.sql'),
    ('league_standings', 'Season enrollment and standings', '0008_server_authoritative_leagues.sql'),
    ('league_matches', 'Team league fixtures/results', '0008_server_authoritative_leagues.sql; 0019_league_operations_and_payouts.sql'),
    ('league_events', 'League operations audit events', '0008_server_authoritative_leagues.sql'),
    ('creator_leagues', 'Separate creator-league feature, not required by /api/teams', '0014_creator_league_server.sql'),
    ('creator_league_admins', 'Separate creator-league feature', '0014_creator_league_server.sql'),
    ('creator_league_registrations', 'Separate creator-league feature', '0014_creator_league_server.sql'),
    ('creator_league_fixtures', 'Separate creator-league feature', '0014_creator_league_server.sql'),
    ('creator_league_score_events', 'Separate creator-league feature', '0014_creator_league_server.sql'),
    ('creator_league_payments', 'Separate creator-league feature', '0014_creator_league_server.sql')
)
select e.object_name,
       to_regclass('public.' || e.object_name) is not null as present_in_postgres,
       e.feature,
       e.migration_hint
from expected e
order by case e.object_name
  when 'profiles' then 1 when 'teams' then 2 when 'team_members' then 3
  when 'leagues' then 4 when 'league_seasons' then 5 when 'league_standings' then 6
  when 'league_matches' then 7 when 'league_events' then 8 else 9 end,
  e.object_name;

-- Result 2: columns used by the current Teams/team-league routes.
-- Missing rows/false values must be compared to the actual migration history
-- before applying a repair. Existing values are not inspected or changed.
with expected(table_name, column_name, feature, migration_hint) as (
  values
    ('profiles','id','Profile joins','0001_identity_social.sql'),
    ('profiles','username','Team member card','0001_identity_social.sql'),
    ('profiles','display_name','Team member card','0001_identity_social.sql'),
    ('teams','id','Team identity','0004_live_social_systems.sql'),
    ('teams','name','Team identity','0004_live_social_systems.sql'),
    ('teams','description','Team create/edit','0015_teams_backend_complete.sql'),
    ('teams','parish','Team create/edit','0015_teams_backend_complete.sql'),
    ('teams','logo_url','Team create/edit','0004_live_social_systems.sql / compatibility migrations'),
    ('teams','badge_url','Team create/edit','0004_live_social_systems.sql / compatibility migrations'),
    ('teams','owner_id','Team ownership','0004_live_social_systems.sql'),
    ('teams','division_code','Official division placement','0008_server_authoritative_leagues.sql / 0017 / 0018'),
    ('teams','points','Legacy display metric; not league promotion','0004_live_social_systems.sql'),
    ('teams','max_members','Membership capacity','0015_teams_backend_complete.sql'),
    ('teams','recruiting','Join eligibility','0015_teams_backend_complete.sql'),
    ('teams','created_at','Team ordering','0004_live_social_systems.sql'),
    ('teams','updated_at','Team update tracking','0015_teams_backend_complete.sql'),
    ('team_members','team_id','Membership relationship','0004_live_social_systems.sql'),
    ('team_members','user_id','Membership relationship','0004_live_social_systems.sql'),
    ('team_members','role','Owner/member distinction','0015_teams_backend_complete.sql'),
    ('team_members','joined_at','Roster ordering','0015_teams_backend_complete.sql'),
    ('leagues','code','Official division identity','0006_seed_config.sql'),
    ('leagues','tier','Official division tier','0016_official_division_tiers.sql'),
    ('leagues','rank','Official division order','0016_official_division_tiers.sql'),
    ('league_seasons','id','Season identity','0008_server_authoritative_leagues.sql'),
    ('league_seasons','name','Season display','0008_server_authoritative_leagues.sql'),
    ('league_seasons','status','Season lifecycle','0008_server_authoritative_leagues.sql'),
    ('league_seasons','starts_at','Season window','0008_server_authoritative_leagues.sql'),
    ('league_seasons','ends_at','Season window','0008_server_authoritative_leagues.sql'),
    ('league_standings','season_id','Season association','0008_server_authoritative_leagues.sql'),
    ('league_standings','team_id','Team association','0008_server_authoritative_leagues.sql'),
    ('league_standings','division_code','Competition placement','0008_server_authoritative_leagues.sql'),
    ('league_standings','played','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','wins','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','draws','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','losses','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','goals_for','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','goals_against','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','points','Computed standings','0008_server_authoritative_leagues.sql'),
    ('league_standings','form','Recent form','0008_server_authoritative_leagues.sql'),
    ('league_standings','position','Table position','0008_server_authoritative_leagues.sql'),
    ('league_standings','promoted','Season outcome','0008_server_authoritative_leagues.sql'),
    ('league_standings','relegated','Season outcome','0008_server_authoritative_leagues.sql'),
    ('league_matches','round_number','Round-robin fixture grouping','0019_league_operations_and_payouts.sql'),
    ('league_matches','home_team_id','Fixture relationship','0008_server_authoritative_leagues.sql'),
    ('league_matches','away_team_id','Fixture relationship','0008_server_authoritative_leagues.sql'),
    ('league_matches','status','Fixture lifecycle','0008_server_authoritative_leagues.sql'),
    ('league_matches','home_score','Match result','0008_server_authoritative_leagues.sql'),
    ('league_matches','away_score','Match result','0008_server_authoritative_leagues.sql')
)
select e.table_name,
       e.column_name,
       e.feature,
       (c.column_name is not null) as present,
       c.data_type,
       c.is_nullable,
       e.migration_hint
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- If Result 1 says public.leagues is present, run this optional catalog check:
-- select code, tier, rank from public.leagues
-- where code in ('A','A1','A2','A3','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5')
-- order by rank, code;

-- Interpretation:
-- * If public.league_seasons is FALSE, inspect 0008_server_authoritative_leagues.sql
--   and its prerequisites before considering any Teams compatibility migration.
-- * If a relation EXISTS in PostgreSQL but PostgREST returns PGRST205, reload the
--   schema cache only after checking the backend points at the same Supabase project:
--   NOTIFY pgrst, 'reload schema';
-- * public.creator_leagues is separate and does not gate /api/teams or the team-league
--   standings API. Do not apply migration 0014 solely to fix /api/teams.
