-- ------------------------------------------------------------------
-- Batch Execution Template for Remaining Function Fixes
-- ------------------------------------------------------------------
-- Simple template to execute ALTER FUNCTION statements in small batches
-- Avoids Supabase editor limitations by keeping transactions simple
-- 
-- Instructions:
-- 1. Run MAIN QUERY from 20250201_GENERATE_ALL_REMAINING_FIXES_SIMPLE.sql
-- 2. Copy 5-10 fix_command values at a time
-- 3. Paste them into one of the batch templates below
-- 4. Execute the batch
-- 5. Run verification query to confirm progress
-- ------------------------------------------------------------------

-- ==================================================================
-- BATCH 1: First 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste first 5-10 ALTER statements here
-- Example:
-- ALTER FUNCTION public.mark_all_notifications_read(uuid) SET search_path = public;
-- ALTER FUNCTION public.notify_on_comment() SET search_path = public;
-- ... (5-10 total)

COMMIT;

-- After executing, run verification query:
-- SELECT 'FUNCTIONS' as type, COUNT(*) as total,
--   SUM(CASE WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 1 ELSE 0 END) as fixed,
--   SUM(CASE WHEN pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%' THEN 1 ELSE 0 END) as remaining
-- FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname NOT LIKE 'pg_%' AND p.proname NOT LIKE '_get_current_%';

-- ==================================================================
-- BATCH 2: Next 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste next 5-10 ALTER statements here

COMMIT;

-- Run verification query after execution

-- ==================================================================
-- BATCH 3: Next 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste next 5-10 ALTER statements here

COMMIT;

-- Run verification query after execution

-- ==================================================================
-- BATCH 4: Next 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste next 5-10 ALTER statements here

COMMIT;

-- Run verification query after execution

-- ==================================================================
-- BATCH 5: Next 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste next 5-10 ALTER statements here

COMMIT;

-- Run verification query after execution

-- ==================================================================
-- BATCH 6: Next 5-10 Functions
-- ==================================================================
BEGIN;

-- Paste next 5-10 ALTER statements here

COMMIT;

-- Run verification query after execution

-- ==================================================================
-- BATCH 7-12: Additional Batches as Needed
-- ==================================================================
-- Continue pattern above for remaining functions
-- With 56 remaining functions, you'll need approximately 6-12 batches
-- of 5-10 functions each

-- ==================================================================
-- FINAL VERIFICATION (Run after all batches complete)
-- ==================================================================
-- Expected result: fixed = 77, remaining = 0, percent_complete = 100.0
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

