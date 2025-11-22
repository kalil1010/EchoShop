-- ------------------------------------------------------------------
-- Fix #1: Set security_invoker on security_dashboard_stats view
-- ------------------------------------------------------------------
-- Phase 2.1: Security Dashboard Stats View Fix
-- 
-- This fix addresses the security issue where the view is defined
-- with SECURITY DEFINER but missing security_invoker setting.
--
-- Risk: Allows SQL injection through unrestricted view access
-- Fix: Set security_invoker=true to restrict view to caller's privileges
-- ------------------------------------------------------------------

DO $$
BEGIN
    -- Check if view exists before attempting to alter
    IF EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'security_dashboard_stats'
    ) THEN
        -- Set security_invoker=true to restrict view access to caller's privileges
        ALTER VIEW public.security_dashboard_stats 
        SET (security_invoker = true);
        
        RAISE NOTICE 'security_dashboard_stats view updated successfully - security_invoker set to true';
    ELSE
        RAISE NOTICE 'security_dashboard_stats view does not exist - skipping this fix';
    END IF;
END $$;

-- Verification Query
-- ------------------------------------------------------------------
-- This should return security_invoker = true if the view exists
SELECT 
    table_schema,
    table_name, 
    security_invoker 
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name = 'security_dashboard_stats';

-- Expected Result: 
-- - If view exists: security_invoker should be 'true'
-- - If view doesn't exist: No rows returned

