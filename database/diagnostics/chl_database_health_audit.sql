-- Read-only Creator Hub Live database health audit.
-- Run in Supabase SQL Editor with a role permitted to inspect system catalogs.
-- This script reports; it does not change schema or data.

-- 1) Foreign keys whose referencing columns do not have a matching leading index.
WITH fk AS (
  SELECT c.oid, c.conname, c.conrelid, c.conkey,
         n.nspname AS schema_name, t.relname AS table_name,
         array_agg(a.attname ORDER BY k.ord) AS columns_names,
         array_agg(a.attnum ORDER BY k.ord) AS columns_nums
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
  WHERE c.contype = 'f' AND n.nspname = 'public'
  GROUP BY c.oid, c.conname, c.conrelid, c.conkey, n.nspname, t.relname
)
SELECT f.schema_name, f.table_name, f.conname,
       array_to_string(f.columns_names, ', ') AS foreign_key_columns
FROM fk f
WHERE NOT EXISTS (
  SELECT 1 FROM pg_index i
  WHERE i.indrelid = f.conrelid AND i.indisvalid AND i.indisready
    AND i.indpred IS NULL
    AND (SELECT array_agg(i.attnum::smallint ORDER BY ord)
         FROM unnest(i.indkey) WITH ORDINALITY AS ix(attnum, ord)
         WHERE ord <= cardinality(f.columns_nums)) = f.columns_nums
)
ORDER BY f.table_name, f.conname;

-- 2) Tables with RLS enabled but no policies (may be intentional for service-only tables).
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p') AND n.nspname = 'public' AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
  )
ORDER BY c.relname;

-- 3) SECURITY DEFINER functions executable by public-facing roles.
-- Review each function's body, search_path, and intended caller before changing grants.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.proconfig AS function_settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND (has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
ORDER BY p.proname;

-- 4) Duplicate/overlapping indexes for human review; do not auto-drop in production.
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5) Migration ledger: compare this list with the checked-in migration directory.
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
