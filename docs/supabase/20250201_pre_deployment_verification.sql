-- ------------------------------------------------------------------
-- Phase 1: Pre-Deployment Verification Queries
-- ------------------------------------------------------------------
-- Run these queries before starting the deployment to:
-- 1. Verify database state
-- 2. Audit functions for SECURITY DEFINER status
-- 3. Identify all RLS policies that need updates
-- 4. Export current state for rollback purposes
-- ------------------------------------------------------------------

-- Query 1: Check if security_dashboard_stats view exists
-- ------------------------------------------------------------------
SELECT 
    table_schema,
    table_name,
    view_definition
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'security_dashboard_stats';

-- Action: 
-- If view exists → Proceed with Fix #1
-- If view doesn't exist → Skip Fix #1 and document reason


-- Query 2: Audit all functions for SECURITY DEFINER status
-- ------------------------------------------------------------------
-- This query identifies which functions need SECURITY DEFINER and search_path
-- Output should be saved to: pre_deployment_function_audit.csv
SELECT 
    p.proname as function_name,
    p.prosecdef as has_security_definer,
    pg_get_function_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN true 
        ELSE false 
    END as has_search_path,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'  -- Exclude our new functions
ORDER BY p.proname;


-- Query 3: Identify all RLS policies using auth.uid() or current_setting()
-- ------------------------------------------------------------------
-- This becomes our migration checklist
-- Output should be saved to: pre_deployment_rls_policies.csv
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    CASE 
        WHEN qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%' 
        THEN 'auth_uid'
        WHEN qual::text LIKE '%current_setting%' OR with_check::text LIKE '%current_setting%'
        THEN 'current_setting'
        ELSE 'other'
    END as policy_type
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual::text LIKE '%auth.uid()%' 
    OR with_check::text LIKE '%auth.uid()%'
    OR qual::text LIKE '%current_setting%'
    OR with_check::text LIKE '%current_setting%'
)
ORDER BY tablename, policyname;


-- Query 4: Export current RLS policies for rollback
-- ------------------------------------------------------------------
-- Output should be saved to: rollback_rls_policies.sql
-- This generates complete DROP and CREATE statements for all current policies
SELECT 
    'DROP POLICY IF EXISTS "' || policyname || '" ON ' || schemaname || '.' || tablename || ';' || E'\n' ||
    'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename ||
    ' FOR ' || cmd ||
    CASE WHEN permissive = 'PERMISSIVE' THEN ' PERMISSIVE' ELSE '' END ||
    CASE WHEN roles IS NOT NULL AND roles != '{public}' THEN 
        ' TO ' || array_to_string(roles, ', ') 
    ELSE '' END ||
    CASE WHEN qual IS NOT NULL THEN 
        ' USING (' || qual || ')' 
    ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN 
        ' WITH CHECK (' || with_check || ')' 
    ELSE '' END || ';' as rollback_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- Query 5: Count functions that need updates
-- ------------------------------------------------------------------
-- Quick summary to estimate work
SELECT 
    COUNT(*) FILTER (WHERE prosecdef = false) as functions_missing_security_definer,
    COUNT(*) FILTER (WHERE prosecdef = true) as functions_with_security_definer,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%';


-- Query 6: Count RLS policies that need updates
-- ------------------------------------------------------------------
-- Quick summary to estimate work
SELECT 
    COUNT(DISTINCT tablename) as tables_with_policies_to_update,
    COUNT(*) as total_policies_to_update
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual::text LIKE '%auth.uid()%' 
    OR with_check::text LIKE '%auth.uid()%'
    OR qual::text LIKE '%current_setting%'
    OR with_check::text LIKE '%current_setting%'
);


-- Query 7: Baseline performance - function call statistics
-- ------------------------------------------------------------------
-- Note: Requires pg_stat_statements extension
-- This helps establish baseline before optimization
SELECT 
    schemaname,
    funcname,
    calls,
    total_time,
    mean_time,
    stddev_time
FROM pg_stat_user_functions
WHERE schemaname = 'public'
ORDER BY calls DESC
LIMIT 20;

