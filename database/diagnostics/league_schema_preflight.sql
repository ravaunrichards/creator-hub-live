-- READ-ONLY Creator Hub league/Teams/wallet/payout schema preflight.
-- Run this against the intended Supabase project before any migration.
-- Every expected column is returned, including absent columns (present = false).

select item.name as object_name,
       to_regclass('public.' || item.name) is not null as present
from (values
  ('profiles'),
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
  ('creator_league_payments'),
  ('league_events'),
  ('wallets'),
  ('coin_ledger'),
  ('diamond_ledger'),
  ('gifts'),
  ('gift_transactions'),
  ('paypal_payout_info'),
  ('diamond_withdrawals')
) as item(name)
order by item.name;

with expected(table_name, column_name, purpose) as (
  values
    ('teams','id','core identity; must not be fabricated'),
    ('teams','name','core identity; must not be fabricated'),
    ('teams','description','Teams API'),
    ('teams','parish','Teams API'),
    ('teams','logo_url','Teams API'),
    ('teams','badge_url','Teams API'),
    ('teams','level','legacy compatibility only; not used for division placement'),
    ('teams','points','Teams API'),
    ('teams','owner_id','team ownership and owner membership'),
    ('teams','created_at','Teams API'),
    ('teams','updated_at','Teams API'),
    ('teams','division_code','official 18-division hierarchy'),
    ('teams','max_members','membership limit'),
    ('teams','recruiting','membership eligibility'),
    ('team_members','team_id','core membership identity'),
    ('team_members','user_id','core membership identity'),
    ('team_members','role','owner/member distinction'),
    ('team_members','joined_at','membership ordering'),
    ('league_seasons','id','season management'),
    ('league_seasons','name','season management'),
    ('league_seasons','status','active/scheduled/completed state'),
    ('league_seasons','starts_at','season date window'),
    ('league_seasons','ends_at','season date window'),
    ('league_seasons','created_at','active-season ordering'),
    ('league_standings','season_id','season membership'),
    ('league_standings','team_id','team membership'),
    ('league_standings','division_code','competition division'),
    ('league_standings','played','computed standings'),
    ('league_standings','wins','computed standings'),
    ('league_standings','draws','computed standings'),
    ('league_standings','losses','computed standings'),
    ('league_standings','goals_for','computed standings'),
    ('league_standings','goals_against','computed standings'),
    ('league_standings','points','computed standings; distinct from legacy teams.points'),
    ('league_standings','form','recent form'),
    ('league_standings','position','rank in division'),
    ('league_standings','promoted','season close outcome'),
    ('league_standings','relegated','season close outcome'),
    ('league_standings','updated_at','standings update time'),
    ('league_matches','id','fixture identity'),
    ('league_matches','season_id','fixture season'),
    ('league_matches','division_code','fixture division'),
    ('league_matches','home_team_id','fixture home team'),
    ('league_matches','away_team_id','fixture away team'),
    ('league_matches','round_number','round-robin schedule grouping'),
    ('league_matches','status','fixture lifecycle'),
    ('league_matches','home_score','result'),
    ('league_matches','away_score','result'),
    ('league_matches','played_at','result timestamp'),
    ('league_matches','created_at','fixture creation time'),
    ('league_events','season_id','league audit event'),
    ('league_events','match_id','league audit event'),
    ('league_events','event_type','league audit event'),
    ('league_events','actor_id','league audit actor'),
    ('league_events','payload','league audit payload'),
    ('wallets','user_id','wallet identity'),
    ('wallets','coin_balance','coin purchase/gift balance'),
    ('wallets','diamond_balance','creator payout source balance'),
    ('wallets','lifetime_gifts_sent','sender gift counter'),
    ('wallets','updated_at','wallet update time'),
    ('coin_ledger','idempotency_key','unique coin movement retry protection'),
    ('diamond_ledger','idempotency_key','unique diamond movement retry protection'),
    ('gift_transactions','idempotency_key','unique gift retry protection'),
    ('diamond_ledger','user_id','creator payout ledger owner'),
    ('diamond_ledger','amount','ledger movement'),
    ('diamond_ledger','balance_before','ledger audit balance'),
    ('diamond_ledger','balance_after','ledger audit balance'),
    ('diamond_ledger','source','ledger movement source'),
    ('diamond_ledger','idempotency_key','idempotent refund/debit entry'),
    ('paypal_payout_info','user_id','creator payout account'),
    ('paypal_payout_info','paypal_email','creator payout destination'),
    ('diamond_withdrawals','id','payout request identity'),
    ('diamond_withdrawals','user_id','payout owner'),
    ('diamond_withdrawals','amount','diamonds requested'),
    ('diamond_withdrawals','status','payout workflow'),
    ('diamond_withdrawals','payout_email_snapshot','destination captured at request time'),
    ('diamond_withdrawals','fiat_amount','administrator-confirmed PayPal amount'),
    ('diamond_withdrawals','fiat_currency','currency code'),
    ('diamond_withdrawals','admin_note','admin audit note'),
    ('diamond_withdrawals','processed_by','admin actor'),
    ('diamond_withdrawals','processed_at','admin processing time'),
    ('diamond_withdrawals','paypal_transaction_id','unique external PayPal transaction reference')
)
select e.table_name,
       e.column_name,
       e.purpose,
       (c.column_name is not null) as present,
       c.data_type,
       c.is_nullable
  from expected e
  left join information_schema.columns c
    on c.table_schema='public'
   and c.table_name=e.table_name
   and c.column_name=e.column_name
 order by e.table_name, e.column_name;

-- The statements below are optional and deliberately commented so the preflight
-- remains readable even when a table is absent. Run each query only after the
-- first result confirms its table exists.
-- Division catalog (run only if public.leagues is present):
-- select code, tier, rank, (code='D5') as is_required_entry
--   from public.leagues
--  where code in ('A1','A2','A3','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5','A')
--  order by rank, code;
-- Season status counts (run only if public.league_seasons is present):
-- select status, count(*) as season_count from public.league_seasons group by status order by status;
-- After a reviewed migration commits, refresh PostgREST from the SQL editor:
-- NOTIFY pgrst, 'reload schema';
