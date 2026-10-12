-- Read-only preflight for Creator Hub Creator Network migration 0024.
-- Run in Supabase SQL Editor against the exact project targeted by the backend.
-- This query does not modify data or prove that every existing policy is safe.
with required_objects(name, expected_kind) as (
  values
    ('public.profiles','table'),('public.follows','table'),('public.blocks','table'),
    ('public.gift_transactions','table'),('public.notifications','table'),('public.user_settings','table'),
    ('public.posts','table'),('public.likes','table'),('public.comments','table'),('public.reposts','table'),
    ('public.saves','table'),('public.conversations','table'),('public.conversation_members','table'),
    ('public.messages','table'),('public.live_sessions','table'),('public.live_guests','table'),
    ('public.get_my_creator_metrics()','function'),('public.create_or_get_direct_conversation(uuid)','function'),
    ('public.creator_battles','table'),('public.creator_missions','table'),('public.creator_mission_claims','table'),
    ('public.creator_verification_requests','table'),('public.public_creator_badges','table'),
    ('public.create_creator_battle(uuid,text,text,timestamp with time zone)','function'),
    ('public.respond_creator_battle(uuid,text)','function'),('public.claim_creator_mission(uuid)','function'),
    ('public.get_public_gift_rankings(text,text,integer)','function')
), resolved as (
  select name, expected_kind,
    case when expected_kind='table' then to_regclass(name) is not null
         when expected_kind='function' then to_regprocedure(name) is not null
         else false end as present
  from required_objects
)
select name, expected_kind, present,
  case when present then 'PRESENT — verify columns, grants and policies below'
       else 'MISSING — do not apply migration 0024 until prerequisites are reconciled' end as recommendation
from resolved order by expected_kind, name;

-- Current profile columns relevant to account state, privacy and public identity.
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('profiles','user_settings','gift_transactions','live_sessions','messages','posts')
  and column_name in ('id','user_id','username','display_name','privacy','account_status','deactivated_at','notifications','live','coin_cost','diamond_value','created_at','author_id','sender_id','recipient_id')
order by table_name, ordinal_position;

-- Effective security inventory for the objects migration 0024 changes or adds.
select c.relname as object_name, c.relkind,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('profiles','follows','blocks','mutes','posts','likes','comments','reposts','saves','messages','notifications','user_settings','live_sessions','live_guests','conversation_members','creator_battles','creator_missions','creator_mission_claims','creator_verification_requests','public_creator_badges')
order by c.relname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public','storage')
  and (tablename in ('profiles','follows','blocks','mutes','posts','likes','comments','reposts','saves','messages','notifications','user_settings','live_sessions','live_guests','conversation_members','creator-content','objects')
       or tablename in ('creator_battles','creator_missions','creator_mission_claims','creator_verification_requests','public_creator_badges'))
order by schemaname, tablename, policyname;

-- Function signatures and grants used by the release.
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proacl, ', '),'(default ACL)') as acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('is_admin','get_my_creator_metrics','save_my_user_settings','create_or_get_direct_conversation','claim_creator_mission','create_creator_battle','respond_creator_battle','get_public_gift_rankings','chcn_my_account_active')
order by p.proname, arguments;

-- If a migrations ledger exists, inspect it; this query is intentionally generic/read-only.
select table_schema, table_name
from information_schema.tables
where table_schema in ('public','supabase_migrations')
  and (table_name ilike '%migration%' or table_name ilike '%schema%')
order by table_schema, table_name;
