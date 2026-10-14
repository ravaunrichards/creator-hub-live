-- Creator Hub Creator Network — READ-ONLY Supabase inventory audit
-- Run in Supabase SQL Editor for the intended project. This file performs SELECTs only.
-- It does NOT create, alter, update, delete, grant, revoke, or seed anything.
-- Save/export the complete query results and share them for the coordinated fix plan.

-- 1) Database and schema overview
select current_database() as database_name,
       current_user as execution_role,
       current_schema() as current_schema,
       version() as postgres_version;

select schema_name
from information_schema.schemata
where schema_name not in ('pg_catalog', 'information_schema')
order by schema_name;

-- 2) All non-system tables/views/materialized views/foreign tables, row security flags
select n.nspname as schema_name,
       c.relname as object_name,
       case c.relkind when 'r' then 'table' when 'p' then 'partitioned table'
            when 'v' then 'view' when 'm' then 'materialized view'
            when 'f' then 'foreign table' when 'S' then 'sequence' else c.relkind::text end as object_type,
       c.reltuples::bigint as estimated_rows,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog','information_schema')
  and n.nspname not like 'pg_toast%'
  and c.relkind in ('r','p','v','m','f','S')
order by n.nspname, c.relkind, c.relname;

-- 3) All columns, types, defaults, nullability, identity/generated metadata
select table_schema, table_name, ordinal_position, column_name,
       data_type, udt_schema, udt_name, is_nullable, column_default,
       is_identity, identity_generation, is_generated, generation_expression
from information_schema.columns
where table_schema not in ('pg_catalog','information_schema')
order by table_schema, table_name, ordinal_position;

-- 4) Primary, unique, foreign-key, and check constraints
select n.nspname as schema_name, c.relname as table_name,
       con.conname as constraint_name,
       case con.contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE'
            when 'f' then 'FOREIGN KEY' when 'c' then 'CHECK'
            when 'x' then 'EXCLUSION' else con.contype::text end as constraint_type,
       pg_get_constraintdef(con.oid, true) as definition,
       con.convalidated as validated
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('pg_catalog','information_schema')
order by n.nspname, c.relname, con.contype, con.conname;

-- 5) Indexes and their definitions
select schemaname as schema_name, tablename as table_name,
       indexname, indexdef
from pg_indexes
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, tablename, indexname;

-- 6) RLS policies
select schemaname as schema_name, tablename as table_name, policyname,
       permissive, roles, cmd, qual as using_expression,
       with_check as check_expression
from pg_policies
where schemaname not in ('pg_catalog','information_schema')
order by schemaname, tablename, policyname;

-- 7) Table/view/sequence privileges visible to current role and explicit grantees
select table_schema, table_name, grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema not in ('pg_catalog','information_schema')
order by table_schema, table_name, grantee, privilege_type;

select object_schema, object_name, object_type, grantee, privilege_type, is_grantable
from information_schema.role_routine_grants
where object_schema not in ('pg_catalog','information_schema')
order by object_schema, object_name, grantee, privilege_type;

-- 8) Functions/RPCs and their security settings / definitions
select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as identity_arguments,
       pg_get_function_result(p.oid) as return_type,
       case p.provolatile when 'i' then 'immutable' when 's' then 'stable' when 'v' then 'volatile' end as volatility,
       p.prosecdef as security_definer,
       r.rolname as owner,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname not in ('pg_catalog','information_schema')
order by n.nspname, p.proname, identity_arguments;

-- 9) Triggers
select trigger_schema as schema_name, event_object_table as table_name,
       trigger_name, event_manipulation, action_timing, action_orientation,
       action_condition, action_statement
from information_schema.triggers
where trigger_schema not in ('pg_catalog','information_schema')
order by trigger_schema, event_object_table, trigger_name;

-- 10) Installed extensions
select e.extname as extension_name, e.extversion as version,
       n.nspname as schema_name
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by e.extname;

-- 11) Migration history, if Supabase CLI migration table exists
select to_regclass('supabase_migrations.schema_migrations') as supabase_migration_table;
-- Run the following only if the preceding result is not NULL:
-- select * from supabase_migrations.schema_migrations order by version;

-- 12) Targeted existence snapshot for known Creator Hub / Teams / league / payment objects
with expected(object_name) as (
  values ('profiles'), ('teams'), ('team_members'), ('leagues'),
         ('league_seasons'), ('creator_leagues'), ('creator_league_teams'),
         ('league_fixtures'), ('league_matches'), ('league_standings'),
         ('coin_purchases'), ('coin_transactions'), ('wallets'), ('payments'),
         ('payouts'), ('creator_payouts'), ('notifications')
)
select e.object_name,
       to_regclass('public.' || e.object_name) as public_object,
       case when to_regclass('public.' || e.object_name) is null then 'MISSING or named differently'
            else 'FOUND' end as status
from expected e
order by e.object_name;

-- 13) Detailed column inventory for public tables with relevant names
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (table_name ilike '%team%' or table_name ilike '%league%'
       or table_name ilike '%coin%' or table_name ilike '%wallet%'
       or table_name ilike '%payment%' or table_name ilike '%payout%'
       or table_name in ('profiles','notifications'))
order by table_name, ordinal_position;

-- 14) Relevant public foreign-key relationships
select tc.table_name, kcu.column_name,
       ccu.table_name as referenced_table, ccu.column_name as referenced_column,
       tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_catalog = kcu.constraint_catalog
 and tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu
  on ccu.constraint_catalog = tc.constraint_catalog
 and ccu.constraint_schema = tc.constraint_schema
 and ccu.constraint_name = tc.constraint_name
where tc.constraint_type = 'FOREIGN KEY'
  and tc.constraint_schema = 'public'
  and (tc.table_name ilike '%team%' or tc.table_name ilike '%league%'
       or tc.table_name ilike '%coin%' or tc.table_name ilike '%wallet%'
       or tc.table_name ilike '%payment%' or tc.table_name ilike '%payout%'
       or tc.table_name in ('profiles','notifications'))
order by tc.table_name, tc.constraint_name;

-- 15) Existing public tables and approximate row counts for target scope only.
-- Estimates only; this does not scan table data or reveal user records.
select n.nspname as schema_name, c.relname as table_name,
       c.reltuples::bigint as estimated_rows,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
  and (c.relname ilike '%team%' or c.relname ilike '%league%'
       or c.relname ilike '%coin%' or c.relname ilike '%wallet%'
       or c.relname ilike '%payment%' or c.relname ilike '%payout%'
       or c.relname in ('profiles','notifications'))
order by c.relname;

-- END: read-only inventory. Do not share secrets, API keys, access tokens, or personal row data.
