-- ------------------------------------------------------------------
-- Function Search Path Fixes - Verification Queries
-- ------------------------------------------------------------------
-- Run these queries independently in Supabase SQL Editor to verify
-- the function search path fixes that were applied.
-- 
-- Status: 55 functions fixed, 2 excluded (DEFAULT parameters)
-- Expected Result: 85-95% improvement (0-10 remaining warnings)
-- ------------------------------------------------------------------

-- ==================================================================
-- QUERY 1: Summary Statistics
-- ==================================================================
-- Shows overall status: total functions, count with/without search_path, and fix percentage
-- Run this FIRST to get a high-level view of the fixes
-- ------------------------------------------------------------------

SELECT 
    'SUMMARY' as check_type,
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path = public%') as with_search_path,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%') as missing_search_path,
    ROUND(100.0 * COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%') / NULLIF(COUNT(*), 0), 1) as percent_fixed
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%';

-- Expected Output:
-- check_type | total_functions | with_search_path | missing_search_path | percent_fixed
-- SUMMARY    | ~65-85          | ~55-75           | 0-10                | 85-95%

-- Interpretation:
-- - with_search_path: Should be ~55+ (functions we fixed)
-- - missing_search_path: Should be 0-10 (remaining functions)
-- - percent_fixed: Should be 85-95%+

-- ==================================================================
-- QUERY 2: Detailed Status by Function
-- ==================================================================
-- Lists all functions with status indicators (✅ HAS or ❌ MISSING)
-- Run this to see exactly which functions are fixed and which still need fixing
-- ------------------------------------------------------------------

SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path = public%' THEN '✅ HAS'
        ELSE '❌ MISSING'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
ORDER BY 
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path = public%' THEN 1
        ELSE 0
    END,
    p.proname;

-- Expected Output:
-- function_name              | arguments | status
-- admin_regenerate_backup... | ()        | ✅ HAS
-- calculate_pending_payout   | (uuid)    | ✅ HAS
-- ... (many more with ✅ HAS)
-- function_with_issue        | (...)     | ❌ MISSING (if any remain)

-- Interpretation:
-- - Functions with ✅ HAS: Already fixed (should be ~55+)
-- - Functions with ❌ MISSING: Still need fixing (should be 0-10)
-- - Functions are sorted: fixed first, then missing

-- ==================================================================
-- QUERY 3: Generate Remaining Fixes (if any)
-- ==================================================================
-- Generates ALTER FUNCTION statements for any remaining functions
-- Run this ONLY if Query 1 shows missing_search_path > 0
-- Use the output to fix remaining functions
-- ------------------------------------------------------------------

SELECT 
    format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
        n.nspname,
        p.proname,
        COALESCE(pg_get_function_identity_arguments(p.oid), '')
    ) as fix_command,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
        THEN '⚠️ Has DEFAULT parameters - may need special handling'
        ELSE 'OK - standard function'
    END as notes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY 
    CASE 
        WHEN pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%' THEN 0
        ELSE 1
    END,
    p.proname;

-- Expected Output (if any remaining functions):
-- fix_command                                              | function_name | arguments | notes
-- ALTER FUNCTION public.function1() SET search_path = ... | function1     | ()        | OK - standard function
-- ALTER FUNCTION public.function2(...) SET search_path=.. | function2     | (p_id uuid DEFAULT 'test') | ⚠️ Has DEFAULT parameters

-- How to Use:
-- 1. If this query returns rows, copy the fix_command column values
-- 2. Wrap in BEGIN/COMMIT transaction:
--    BEGIN;
--    -- Paste all ALTER statements here
--    COMMIT;
-- 3. Execute the transaction
-- 4. Re-run Query 1 to verify

-- ==================================================================
-- BONUS QUERY: Identify Functions with DEFAULT Parameters
-- ==================================================================
-- Use this to identify the 2 special case functions mentioned
-- ------------------------------------------------------------------

SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN '✅ Already has search_path'
        ELSE '❌ Missing search_path'
    END as search_path_status,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
  AND p.proname NOT LIKE 'pg_%'
ORDER BY p.proname;

-- Expected Output:
-- Shows the 2 functions with DEFAULT parameters
-- - If search_path_status = '❌ Missing search_path': These need manual fixing
-- - If search_path_status = '✅ Already has search_path': These were fixed manually

-- How to Fix Functions with DEFAULT Parameters:
-- 1. Check the full_definition column to see the exact signature
-- 2. Copy the exact parameter list including DEFAULT values
-- 3. Create ALTER statement manually:
--    ALTER FUNCTION public.function_name(param1 type1, param2 type2 DEFAULT 'value') 
--    SET search_path = public;
-- 4. Execute individually

-- ==================================================================
-- BONUS QUERY: Detailed Breakdown by Category
-- ==================================================================
-- Shows how many functions are fixed vs missing by category
-- ------------------------------------------------------------------

SELECT 
    CASE 
        WHEN p.proname LIKE 'admin_%' THEN 'Admin Functions'
        WHEN p.proname LIKE 'get_%' OR p.proname LIKE 'calculate_%' THEN 'Query/Aggregation Functions'
        WHEN p.proname LIKE 'touch_%' OR p.proname LIKE 'update_%' THEN 'Update/Trigger Functions'
        WHEN p.proname LIKE '%2fa%' OR p.proname LIKE '%auth%' THEN 'Security/Auth Functions'
        WHEN p.proname LIKE 'vendor_%' OR p.proname LIKE '%vendor%' THEN 'Vendor Functions'
        WHEN p.proname LIKE '%notification%' OR p.proname LIKE 'notify_%' THEN 'Notification Functions'
        ELSE 'Other Functions'
    END as category,
    COUNT(*) as total_in_category,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path = public%') as fixed_in_category,
    COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%') as missing_in_category,
    ROUND(100.0 * COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path = public%') / NULLIF(COUNT(*), 0), 1) as percent_fixed
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
GROUP BY 
    CASE 
        WHEN p.proname LIKE 'admin_%' THEN 'Admin Functions'
        WHEN p.proname LIKE 'get_%' OR p.proname LIKE 'calculate_%' THEN 'Query/Aggregation Functions'
        WHEN p.proname LIKE 'touch_%' OR p.proname LIKE 'update_%' THEN 'Update/Trigger Functions'
        WHEN p.proname LIKE '%2fa%' OR p.proname LIKE '%auth%' THEN 'Security/Auth Functions'
        WHEN p.proname LIKE 'vendor_%' OR p.proname LIKE '%vendor%' THEN 'Vendor Functions'
        WHEN p.proname LIKE '%notification%' OR p.proname LIKE 'notify_%' THEN 'Notification Functions'
        ELSE 'Other Functions'
    END
ORDER BY missing_in_category DESC, category;

-- Expected Output:
-- Shows breakdown by function category
-- - Helps identify which categories are fully fixed vs. need attention
-- - Use to focus remaining fixes on specific categories if needed

-- ==================================================================
-- VERIFICATION CHECKLIST
-- ==================================================================
-- Use this checklist after running the queries above:
-- ------------------------------------------------------------------
-- [ ] Query 1 shows percent_fixed >= 85%
-- [ ] Query 1 shows missing_search_path <= 10
-- [ ] Query 2 shows most functions with ✅ HAS status
-- [ ] Query 2 shows 0-10 functions with ❌ MISSING status
-- [ ] Query 3 generates 0-10 ALTER statements (if any remain)
-- [ ] Bonus Query identifies the 2 DEFAULT parameter functions
-- [ ] All standard functions are fixed (✅ HAS status)
-- [ ] Remaining functions are either special cases or system functions
-- [ ] Supabase linter refreshed and shows 0-10 security warnings (down from 65)

