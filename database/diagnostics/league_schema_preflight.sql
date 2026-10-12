-- READ-ONLY schema preflight. Run before applying any migration.
-- `present = false` means the table is absent from the selected database/schema.
select item.name as object_name,
       to_regclass('public.' || item.name) is not null as present
from (values
  ('teams'),
  ('team_members'),
  ('leagues'),
  ('league_seasons'),
  ('league_standings'),
  ('league_matches'),
  ('profiles'),
  ('creator_leagues'),
  ('creator_league_admins'),
  ('creator_league_registrations'),
  ('creator_league_fixtures'),
  ('creator_league_score_events'),
  ('creator_league_payments')
) as item(name)
order by item.name;

-- Show every column queried by the Teams API, plus the season/standings columns.
-- This is read-only and exposes the exact absent column that can cause SQLSTATE 42703.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'teams' and column_name in (
      'id','name','description','parish','logo_url','badge_url','level','points',
      'division_code','owner_id','max_members','recruiting','created_at','updated_at'
    ))
    or (table_name = 'team_members' and column_name in ('team_id','user_id','role','joined_at'))
    or (table_name = 'league_seasons' and column_name in ('id','name','status','starts_at','ends_at','created_at'))
    or (table_name = 'league_standings' and column_name in (
      'season_id','team_id','division_code','played','wins','draws','losses',
      'goals_for','goals_against','points','form','position','promoted','relegated','updated_at'
    ))
  )
order by table_name, ordinal_position;

-- Run this separately AFTER the appropriate migration has been applied:
-- NOTIFY pgrst, 'reload schema';
