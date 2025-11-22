-- ------------------------------------------------------------------
-- Fix All Function Search Path Warnings (65 functions)
-- ------------------------------------------------------------------
-- This addresses all 65 "Function Search Path Mutable" security warnings
-- 
-- Issue: Functions created without SET search_path = public
-- Severity: Medium (schema pollution risk)
-- Fix Time: 30-60 minutes
-- Expected Result: 65 warnings → 0 warnings (100% reduction)
-- ------------------------------------------------------------------

-- STEP 1: Generate all ALTER FUNCTION statements
-- ------------------------------------------------------------------
-- Run this query FIRST to generate all the ALTER statements you need
-- Copy the output from the "fix_command" column
SELECT 
    format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
        n.nspname,
        p.proname,
        COALESCE(pg_get_function_identity_arguments(p.oid), '')
    ) as fix_command,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as function_args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'  -- Only functions
AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internals
AND p.proname NOT LIKE '_get_current_%'  -- Exclude our new STABLE functions
-- Only functions that DON'T have search_path set
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
ORDER BY p.proname;

-- Expected Output: ~65 rows with ALTER FUNCTION statements
-- Copy all the "fix_command" column values and execute them below

-- STEP 2: Execute all fixes in a single transaction
-- ------------------------------------------------------------------
-- PASTE ALL THE GENERATED ALTER FUNCTION STATEMENTS HERE
-- Then wrap them in BEGIN/COMMIT and execute
BEGIN;

-- Paste all generated ALTER FUNCTION statements here
-- Example format (replace with actual generated statements):
-- ALTER FUNCTION public.admin_regenerate_backup_codes() SET search_path = public;
-- ALTER FUNCTION public.calculate_pending_payout(uuid) SET search_path = public;
-- ... (65 total)

COMMIT;

-- STEP 3: Verification - Check how many functions still need fixing
-- ------------------------------------------------------------------
-- Run this AFTER executing the fixes to verify success
SELECT 
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
    ) as functions_still_missing_search_path,
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        OR p.proname LIKE '_get_current_%'
    ) as functions_with_search_path,
    COUNT(*) as total_functions_checked
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%';

-- Expected Result After Fix:
-- functions_still_missing_search_path: 0 (or very close to 0)
-- functions_with_search_path: Should match total_functions_checked

-- STEP 4: Detailed Verification - See which functions still need fixing
-- ------------------------------------------------------------------
-- Shows exactly which functions (if any) still need search_path
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN '✅ HAS search_path'
        ELSE '❌ MISSING search_path'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'
ORDER BY 
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN 1 
        ELSE 0 
    END,
    p.proname;

-- Expected Result After Fix:
-- All functions should show '✅ HAS search_path'
-- If any show '❌ MISSING search_path', add ALTER statements for those

-- STEP 5: Count warnings before/after (for reporting)
-- ------------------------------------------------------------------
-- Before fix (baseline)
SELECT 
    'Functions missing search_path' as metric,
    COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
UNION ALL
-- After fix (verification)
SELECT 
    'Functions with search_path' as metric,
    COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND (pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
     OR p.proname LIKE '_get_current_%');

-- Expected Result After Fix:
-- Functions missing search_path: 0
-- Functions with search_path: ~85+ (all functions)

