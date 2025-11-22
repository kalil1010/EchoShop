-- ------------------------------------------------------------------
-- Generate ALTER FUNCTION Statements for Remaining 56 Functions
-- ------------------------------------------------------------------
-- Simple query that generates clean ALTER statements without complex
-- DO blocks or aggregate functions - avoids Supabase editor limitations
-- 
-- Status: 21 functions fixed, 56 remaining (27% complete)
-- Use: Run this query, copy all fix_command values, execute in batches
-- ------------------------------------------------------------------

-- ==================================================================
-- MAIN QUERY: Generate All Remaining ALTER Statements
-- ==================================================================
-- This generates one clean ALTER statement per function
-- Each function overload appears as a separate row (correct behavior)
-- ------------------------------------------------------------------

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
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY p.proname, p.oid;

-- Expected Output: ~56 rows with ALTER FUNCTION statements
-- Copy ALL values from the fix_command column
-- Execute in batches of 5-10 statements at a time

-- ==================================================================
-- VERIFICATION QUERY: Current Progress Check
-- ==================================================================
-- Run this BEFORE and AFTER executing batches to track progress
-- ------------------------------------------------------------------

SELECT 
    'FUNCTIONS' as type,
    COUNT(*) as total,
    SUM(CASE WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 1 ELSE 0 END) as fixed,
    SUM(CASE WHEN pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%' THEN 1 ELSE 0 END) as remaining,
    ROUND(100.0 * SUM(CASE WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) as percent_complete
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%';

-- Expected Output BEFORE fixes:
-- type     | total | fixed | remaining | percent_complete
-- FUNCTIONS| 77    | 21    | 56        | 27.3

-- Expected Output AFTER all fixes:
-- type     | total | fixed | remaining | percent_complete
-- FUNCTIONS| 77    | 77    | 0         | 100.0

-- ==================================================================
-- LIST REMAINING FUNCTIONS (for reference)
-- ==================================================================
-- Shows which functions still need fixing (for documentation)
-- ------------------------------------------------------------------

SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY p.proname, p.oid;

-- Use this to see which specific functions still need fixing
-- Each function overload appears as a separate row

