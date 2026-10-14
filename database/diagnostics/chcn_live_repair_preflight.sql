-- Creator Hub Creator Network — READ-ONLY live repair preflight
-- Run in the Supabase SQL editor before any migration. This file performs no writes.
-- It does not infer migration history from the numeric filenames.

-- Result set 1: migration history tracking (some manual installs have no tracking table).
select 'migration_history' as check_group,
       coalesce(to_regclass('supabase_migrations.schema_migrations')::text,'NOT PRESENT') as object_name,
       case when to_regclass('supabase_migrations.schema_migrations') is null then 'UNAVAILABLE — compare installed objects with the release bundle' else 'PRESENT' end as state;

-- Result set 2: required relations and key columns for the selected repair sequence.
with required(kind, object_name, migration) as (
 values
 ('table','public.profiles','0001 / 0024'),('table','public.teams','0004 / 0015'),
 ('table','public.team_members','0004 / 0015'),('table','public.leagues','0006 / 0016'),
 ('table','public.league_seasons','0008 / 0018'),('table','public.league_standings','0008 / 0018'),
 ('table','public.league_matches','0008 / 0019'),('table','public.league_events','0008 / 0019'),
 ('table','public.wallets','0003 / 0020'),('table','public.coin_ledger','0003 / 0020'),
 ('table','public.diamond_ledger','0003 / 0020'),('table','public.diamond_withdrawals','0003 / 0019'),
 ('table','public.gifts','0003 / 0020'),('table','public.gift_transactions','0004 / 0020'),
 ('table','public.follows','0001 / 0021'),('table','public.posts','0002 / 0023'),
 ('table','public.notifications','0004 / 0023'),('table','public.reports','0005 / 0023'),
 ('column','public.profiles.id','0001'),('column','public.teams.id','0004 / 0015'),
 ('column','public.teams.name','0004 / 0015'),('column','public.team_members.team_id','0004 / 0015'),
 ('column','public.team_members.user_id','0004 / 0015'),('column','public.leagues.code','0006 / 0018'),
 ('column','public.league_seasons.id','0008 / 0018'),('column','public.league_standings.season_id','0008 / 0018'),
 ('column','public.league_matches.season_id','0008 / 0019'),('column','public.diamond_withdrawals.user_id','0003 / 0019'),
 ('column','public.wallets.user_id','0003 / 0020'),('column','public.gift_transactions.sender_id','0004 / 0020'),
 ('column','public.gift_transactions.recipient_id','0004 / 0020'),('column','public.gift_transactions.gift_id','0004 / 0020')
)
select r.kind,r.object_name,r.migration,
 case when r.kind='table' then case when to_regclass(r.object_name) is not null then 'PRESENT' else 'MISSING' end
      else case when exists(select 1 from information_schema.columns c where c.table_schema=split_part(r.object_name,'.',1) and c.table_name=split_part(r.object_name,'.',2) and c.column_name=split_part(r.object_name,'.',3)) then 'PRESENT' else 'MISSING' end end as state
from required r order by r.kind,r.object_name;

-- Result set 3: objects known to be absent in the audit and restored by migrations 0015, 0018, 0019, 0021, 0023, 0024 and 0025.
with required(kind, object_name, signature, migration) as (
 values
 ('column','public.profiles.account_status',null,'0024'),('column','public.profiles.deactivated_at',null,'0024'),
 ('column','public.teams.description',null,'0015 / 0018'),('column','public.teams.parish',null,'0015 / 0018'),
 ('column','public.teams.recruiting',null,'0015 / 0018'),('column','public.teams.max_members',null,'0015 / 0018'),
 ('column','public.team_members.joined_at',null,'0015 / 0018'),('column','public.league_matches.round_number',null,'0019'),
 ('column','public.diamond_withdrawals.payout_email_snapshot',null,'0019'),('column','public.diamond_withdrawals.fiat_amount',null,'0019'),
 ('column','public.user_settings.appearance',null,'0025'),
 ('table','public.user_settings',null,'0021 / 0023'),('table','public.live_schedules',null,'0023'),
 ('table','public.paypal_payout_info',null,'0019'),('table','public.creator_battles',null,'0024'),
 ('table','public.creator_missions',null,'0024'),('table','public.creator_mission_claims',null,'0024'),
 ('table','public.creator_verification_requests',null,'0024'),('table','public.public_creator_badges',null,'0024'),
 ('function','public.get_my_creator_metrics', '','0023'),
 ('function','public.get_public_creator_rankings','text,integer','0023 / 0024'),
 ('function','public.get_public_gift_rankings','text,text,integer','0024'),
 ('function','public.request_creator_payout','uuid,bigint,text,text','0019'),
 ('function','public.admin_update_creator_payout','uuid,text,numeric,text,text,text,uuid','0019'),
 ('function','public.save_my_user_settings','jsonb,jsonb,jsonb','0023'),
 ('function','public.chcn_my_account_active','','0024')
)
select r.kind,r.object_name,r.migration,
 case when r.kind='table' then case when to_regclass(r.object_name) is not null then 'PRESENT' else 'MISSING' end
      when r.kind='column' then case when exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=split_part(r.object_name,'.',2) and c.column_name=split_part(r.object_name,'.',3)) then 'PRESENT' else 'MISSING' end
      else case when (case when coalesce(r.signature,'')='' then to_regprocedure(r.object_name||'()') else to_regprocedure(r.object_name||'('||r.signature||')') end) is not null then 'PRESENT' else 'MISSING' end end as state
from required r order by r.kind,r.object_name;

-- Result set 4: non-sensitive financial-integrity checks required before considering 0020.
select 'wallet NULL/negative rows' as check_name,count(*) as issue_count from public.wallets where user_id is null or coin_balance is null or diamond_balance is null or lifetime_gifts_sent is null or coin_balance<0 or diamond_balance<0 or lifetime_gifts_sent<0
union all select 'duplicate wallet owners',count(*) from (select user_id from public.wallets group by user_id having count(*)>1) q
union all select 'duplicate gift idempotency keys',count(*) from (select idempotency_key from public.gift_transactions where idempotency_key is not null group by idempotency_key having count(*)>1) q
union all select 'duplicate coin ledger idempotency keys',count(*) from (select idempotency_key from public.coin_ledger where idempotency_key is not null group by idempotency_key having count(*)>1) q
union all select 'duplicate diamond ledger idempotency keys',count(*) from (select idempotency_key from public.diamond_ledger where idempotency_key is not null group by idempotency_key having count(*)>1) q
order by check_name;

-- Result set 5: exact active rows are summarized only; no account/payment details are returned.
select 'profiles' table_name,count(*)::bigint row_count from public.profiles
union all select 'payments',count(*) from public.payments
union all select 'teams',count(*) from public.teams
union all select 'league_seasons',count(*) from public.league_seasons
union all select 'league_matches',count(*) from public.league_matches
union all select 'diamond_withdrawals',count(*) from public.diamond_withdrawals
union all select 'gift_transactions',count(*) from public.gift_transactions
order by table_name;
