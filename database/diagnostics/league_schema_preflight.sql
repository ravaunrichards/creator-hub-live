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
  ('creator_leagues'),
  ('creator_league_admins'),
  ('creator_league_registrations'),
  ('creator_league_fixtures'),
  ('creator_league_score_events'),
  ('creator_league_payments')
) as item(name)
order by item.name;

-- Also show the critical Teams columns without changing any data.
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (table_name = 'teams' and column_name in ('division_code','level','owner_id','max_members','recruiting')
       or table_name = 'team_members' and column_name in ('team_id','user_id','role','joined_at'))
order by table_name, ordinal_position;

-- Run this separately AFTER the appropriate migration has been applied:
-- NOTIFY pgrst, 'reload schema';
