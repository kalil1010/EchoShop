-- ------------------------------------------------------------------
-- Generate ALTER FUNCTION Statements for Remaining Functions
-- ------------------------------------------------------------------
-- This query generates clean ALTER FUNCTION statements for all functions
-- that are missing search_path, avoiding complex WHERE conditions
-- that cause issues in Supabase SQL editor.
-- 
-- Status: 21 functions fixed, 56 remaining
-- Use: Copy the fix_command column values and execute in batches
-- ------------------------------------------------------------------

-- ==================================================================
-- MAIN QUERY: Generate ALTER Statements for All Remaining Functions
-- ==================================================================
-- This generates one ALTER statement per function, including proper
-- parameter signatures and handling function overloads correctly
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
    ROW_NUMBER() OVER (ORDER BY p.proname, p.oid) as batch_number
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
ORDER BY p.proname, p.oid;

-- Expected Output:
-- ~56 rows with ALTER FUNCTION statements
-- Copy all fix_command values and execute in batches

-- ==================================================================
-- VERIFICATION: Check Current Status
-- ==================================================================
-- Run this BEFORE generating fixes to see current progress
-- ------------------------------------------------------------------

SELECT 
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        OR p.proname LIKE '_get_current_%'
    ) as functions_with_search_path,
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
    ) as functions_missing_search_path,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%';

-- Expected Output:
-- functions_with_search_path: ~21 (current fixed)
-- functions_missing_search_path: ~56 (remaining)
-- total_functions: ~77

-- ==================================================================
-- IDENTIFY FUNCTION OVERLOADS
-- ==================================================================
-- Shows functions that have multiple overloads (same name, different params)
-- These need special attention - each overload needs its own ALTER statement
-- ------------------------------------------------------------------

SELECT 
    p.proname as function_name,
    COUNT(*) as overload_count,
    array_agg(pg_get_function_identity_arguments(p.oid) ORDER BY p.oid) as all_signatures
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%'
  AND p.proname NOT LIKE '_get_current_%'
  AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
GROUP BY p.proname
HAVING COUNT(*) > 1
ORDER BY p.proname;

-- This shows functions with multiple overloads
-- Each overload appears as a separate row in the MAIN QUERY above
-- All overloads will be included in the fix_command output

-- ==================================================================
-- SAFE BATCH EXECUTION TEMPLATE
-- ==================================================================
-- Copy the generated ALTER statements into this template
-- Execute in Supabase SQL Editor
-- ------------------------------------------------------------------

/*
BEGIN;

-- Batch 1: Paste first 10 ALTER statements here
-- ALTER FUNCTION public.function1() SET search_path = public;
-- ALTER FUNCTION public.function2(uuid) SET search_path = public;
-- ... (10 statements)

COMMIT;
*/

-- Recommendation: Execute in batches of 10-15 functions at a time
-- This avoids Supabase editor timeouts and makes progress tracking easier

