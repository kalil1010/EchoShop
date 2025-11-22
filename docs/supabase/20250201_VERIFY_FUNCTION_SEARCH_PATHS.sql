-- ------------------------------------------------------------------
-- Verification Query: Function Search Path Fixes
-- ------------------------------------------------------------------
-- Run this AFTER executing the 65 function search path fixes
-- This verifies how many functions still need fixing
-- ------------------------------------------------------------------

-- Verification 1: Count functions missing search_path
-- ------------------------------------------------------------------
SELECT 
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
        AND p.proname NOT LIKE 'pg_%'
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
-- functions_still_missing_search_path: 0-10 (depending on system functions)
-- functions_with_search_path: Should be high (85-95% of total)

-- Verification 2: Detailed list of functions still missing search_path
-- ------------------------------------------------------------------
-- Shows exactly which functions (if any) still need search_path
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN '✅ HAS search_path'
        ELSE '❌ MISSING search_path'
    END as status,
    pg_get_functiondef(p.oid) as full_definition
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

-- This will show:
-- - Functions with ✅ (already fixed)
-- - Functions with ❌ (still need fixing - likely system functions or special cases)

-- Verification 3: Generate ALTER statements for any remaining functions
-- ------------------------------------------------------------------
-- If Verification 2 shows any functions still missing search_path,
-- run this to generate ALTER statements for those specific functions
SELECT 
    format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
        n.nspname,
        p.proname,
        COALESCE(pg_get_function_identity_arguments(p.oid), '')
    ) as fix_command,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as function_args,
    CASE 
        WHEN pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
        THEN '⚠️ Has DEFAULT parameters - may need special handling'
        ELSE 'OK'
    END as notes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
ORDER BY p.proname;

-- This generates ALTER statements ONLY for functions still missing search_path
-- Use this if Verification 1 shows functions_still_missing_search_path > 0

-- Verification 4: Summary statistics
-- ------------------------------------------------------------------
SELECT 
    'Functions Fixed' as metric,
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        OR p.proname LIKE '_get_current_%'
    ) as count,
    ROUND(
        100.0 * COUNT(*) FILTER (
            WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
            OR p.proname LIKE '_get_current_%'
        ) / NULLIF(COUNT(*), 0),
        2
    ) as percentage
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
UNION ALL
SELECT 
    'Functions Still Missing' as metric,
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
    ) as count,
    ROUND(
        100.0 * COUNT(*) FILTER (
            WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
            AND p.proname NOT LIKE '_get_current_%'
        ) / NULLIF(COUNT(*), 0),
        2
    ) as percentage
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%';

-- This provides a summary of:
-- - How many functions are fixed (with percentage)
-- - How many still need fixing (with percentage)

-- Verification 5: Check for functions with DEFAULT parameters (special cases)
-- ------------------------------------------------------------------
-- Functions with DEFAULT parameters may need special handling
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
ORDER BY p.proname;

-- These functions may require special ALTER FUNCTION syntax
-- If any functions appear here, they need manual review

