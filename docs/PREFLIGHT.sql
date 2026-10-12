-- Read-only preflight. Run before applying 0015.
select
  to_regclass('public.teams') as teams_table,
  to_regclass('public.team_members') as team_members_table,
  to_regclass('public.leagues') as leagues_table,
  to_regclass('public.league_seasons') as league_seasons_table,
  to_regclass('public.league_standings') as league_standings_table;

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('teams', 'team_members')
  and column_name in (
    'id','name','owner_id','level','points','division_code',
    'team_id','user_id','role','joined_at'
  )
order by table_name, ordinal_position;

select code, tier, rank
from public.leagues
where code in ('A','A1','A2','A3','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5')
order by rank;
