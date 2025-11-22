-- ------------------------------------------------------------------
-- Generate All Function Search Path Fixes - Complete Solution
-- ------------------------------------------------------------------
-- This file generates ALL ALTER FUNCTION statements needed to fix
-- the 65 "Function Search Path Mutable" warnings
--
-- Usage:
-- 1. Run the query below to generate all ALTER statements
-- 2. Copy the output
-- 3. Execute in Supabase SQL Editor
-- 4. Verify with the verification query
-- ------------------------------------------------------------------

-- GENERATE ALL FIX COMMANDS
-- ------------------------------------------------------------------
-- This query generates all ALTER FUNCTION commands needed
-- Run this and copy the output to execute
SELECT 
    format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
        n.nspname,
        p.proname,
        COALESCE(pg_get_function_identity_arguments(p.oid), '')
    ) as fix_command
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'  -- Only functions
AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internals
AND p.proname NOT LIKE '_get_current_%'  -- Exclude our new STABLE functions
-- Only functions that DON'T have search_path set
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
ORDER BY p.proname;

-- Expected Output:
-- You'll get a list of ALTER FUNCTION statements like:
-- ALTER FUNCTION public.admin_regenerate_backup_codes() SET search_path = public;
-- ALTER FUNCTION public.calculate_pending_payout(uuid) SET search_path = public;
-- ... (65 total)

-- VERIFICATION QUERY (Run After Fixes)
-- ------------------------------------------------------------------
-- After executing all the ALTER statements, run this to verify
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

-- DETAILED VERIFICATION (Run After Fixes)
-- ------------------------------------------------------------------
-- Shows exactly which functions still need fixing (if any)
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

