-- ------------------------------------------------------------------
-- Fix Security Dashboard Stats View (1 Error)
-- ------------------------------------------------------------------
-- This addresses the "Security Definer View" error for security_dashboard_stats
-- 
-- Issue: View may expose sensitive data if not properly secured
-- Impact: Low-Medium - depends on view contents
-- Fix: Review and secure the view appropriately
-- ------------------------------------------------------------------

-- Step 1: Check if view exists and inspect its definition
-- ------------------------------------------------------------------
SELECT 
    table_schema,
    table_name,
    view_definition,
    security_invoker
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'security_dashboard_stats';

-- Step 2: Review view definition for sensitive data
-- ------------------------------------------------------------------
-- Examine what the view returns and whether SECURITY_DEFINER is necessary
-- If the view exposes sensitive data, consider:
-- 1. Removing SECURITY_DEFINER if not needed
-- 2. Adding RLS policies if needed
-- 3. Restricting access to specific roles

-- Step 3: Fix Option A - Set security_invoker if supported (PostgreSQL 15+)
-- ------------------------------------------------------------------
-- This restricts the view to caller's privileges instead of owner's
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'security_dashboard_stats'
    ) THEN
        -- Only run if PostgreSQL 15+ (security_invoker supported)
        IF current_setting('server_version_num')::int >= 150000 THEN
            BEGIN
                ALTER VIEW public.security_dashboard_stats 
                SET (security_invoker = true);
                RAISE NOTICE 'security_dashboard_stats view updated - security_invoker set to true';
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Could not set security_invoker: %. This may require manual review.', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'security_invoker not supported on PostgreSQL < 15. View requires manual review.';
        END IF;
    ELSE
        RAISE NOTICE 'security_dashboard_stats view does not exist - skipping';
    END IF;
END $$;

-- Step 4: Fix Option B - Remove SECURITY_DEFINER if not needed
-- ------------------------------------------------------------------
-- Only run this if SECURITY_DEFINER is not necessary for the view
-- Uncomment and adjust as needed based on view review:
/*
DROP VIEW IF EXISTS public.security_dashboard_stats CASCADE;
CREATE VIEW public.security_dashboard_stats AS
  -- Recreate view without SECURITY_DEFINER if not needed
  SELECT ...;
*/

-- Step 5: Fix Option C - Add RLS if view accesses sensitive tables
-- ------------------------------------------------------------------
-- If the view accesses tables with sensitive data, ensure those tables
-- have proper RLS policies. Views inherit RLS from underlying tables.

-- Step 6: Verification
-- ------------------------------------------------------------------
SELECT 
    table_name,
    security_invoker,
    CASE 
        WHEN security_invoker = true THEN '✅ Secured (security_invoker = true)'
        WHEN security_invoker = false THEN '⚠️ Review recommended'
        ELSE 'ℹ️ Feature not supported'
    END as security_status
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'security_dashboard_stats';

-- Expected Result:
-- - If view exists and PostgreSQL 15+: security_invoker = true
-- - If view doesn't exist: No rows returned (fine)
-- - If PostgreSQL < 15: Manual review required

