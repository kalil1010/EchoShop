-- ------------------------------------------------------------------
-- Phase 5: Final Deployment Verification Queries
-- ------------------------------------------------------------------
-- Run these queries after completing all deployment phases to verify
-- that all fixes have been applied correctly.
-- ------------------------------------------------------------------

-- Query 1: Verify all functions have SECURITY DEFINER
-- ------------------------------------------------------------------
-- Expected: total_functions = with_security_definer
SELECT 
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE prosecdef = true) as with_security_definer,
    COUNT(*) FILTER (WHERE prosecdef = false) as missing_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%';

-- Query 2: Verify all functions have SET search_path
-- ------------------------------------------------------------------
-- Expected: All functions should have search_path set
SELECT 
    COUNT(*) as total_functions,
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
    ) as with_search_path,
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
        AND p.proname NOT LIKE '_get_current_%'
    ) as missing_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%';

-- Query 3: Verify view security (if exists)
-- ------------------------------------------------------------------
SELECT 
    table_name, 
    security_invoker 
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name = 'security_dashboard_stats';

-- Expected: If view exists, security_invoker should be 'true'
-- If view doesn't exist, no rows returned (which is fine)

-- Query 4: Verify STABLE functions exist and are marked correctly
-- ------------------------------------------------------------------
SELECT 
    proname as function_name,
    prosecdef as has_security_definer,
    provolatile as volatility,  -- 's' = STABLE, 'i' = IMMUTABLE, 'v' = VOLATILE
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '_get_current_%'
ORDER BY proname;

-- Expected Result:
-- - _get_current_user_id() - has_security_definer = true, volatility = 's'
-- - _get_current_user_role() - has_security_definer = true, volatility = 's'
-- - _get_current_vendor_id() - has_security_definer = true, volatility = 's'

-- Query 5: Verify RLS policies updated
-- ------------------------------------------------------------------
-- Count policies using new cached functions vs legacy auth.uid()
SELECT 
    COUNT(*) FILTER (
        WHERE qual::text LIKE '%_get_current_user_id()%' 
        OR qual::text LIKE '%_get_current_user_role()%'
        OR qual::text LIKE '%_get_current_vendor_id()%'
        OR with_check::text LIKE '%_get_current_user_id()%'
        OR with_check::text LIKE '%_get_current_user_role()%'
        OR with_check::text LIKE '%_get_current_vendor_id()%'
    ) as updated_policies,
    COUNT(*) FILTER (
        WHERE qual::text LIKE '%auth.uid()%' 
        OR with_check::text LIKE '%auth.uid()%'
    ) as legacy_auth_uid_policies,
    COUNT(*) FILTER (
        WHERE qual::text LIKE '%current_setting%' 
        OR with_check::text LIKE '%current_setting%'
    ) as legacy_current_setting_policies
FROM pg_policies
WHERE schemaname = 'public';

-- Expected: 
-- - updated_policies > 0 (should match count from pre-deployment audit)
-- - legacy_auth_uid_policies = 0 (all should be updated)
-- - legacy_current_setting_policies = 0 (all should be updated)

-- Query 6: Detailed RLS policy audit by table
-- ------------------------------------------------------------------
-- Shows which tables still have legacy auth.uid() (should be none)
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual::text LIKE '%auth.uid()%' OR with_check::text LIKE '%auth.uid()%'
        THEN 'LEGACY - needs update'
        WHEN qual::text LIKE '%_get_current_user_id()%' OR with_check::text LIKE '%_get_current_user_id()%'
        THEN 'UPDATED'
        ELSE 'OK or no auth check'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
AND (
    qual::text LIKE '%auth.uid()%' 
    OR with_check::text LIKE '%auth.uid()%'
    OR qual::text LIKE '%_get_current_user_id()%'
    OR with_check::text LIKE '%_get_current_user_id()%'
)
ORDER BY policy_status DESC, tablename, policyname;

-- Expected: All policies should show 'UPDATED' status

-- Query 7: Summary of deployment success
-- ------------------------------------------------------------------
SELECT 
    'Security Dashboard Stats View' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'security_dashboard_stats'
        ) THEN 
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM information_schema.views 
                    WHERE table_schema = 'public' 
                    AND table_name = 'security_dashboard_stats'
                    AND security_invoker = true
                ) THEN '✅ FIXED'
                ELSE '⚠️ EXISTS BUT NOT FIXED'
            END
        ELSE 'ℹ️ DOES NOT EXIST (skipped)'
    END as status
UNION ALL
SELECT 
    'Functions with SECURITY DEFINER' as check_name,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND p.proname NOT LIKE 'pg_%'
            AND p.proname NOT LIKE '_get_current_%'
            AND p.prosecdef = false
        ) THEN '✅ ALL FIXED'
        ELSE '⚠️ SOME MISSING'
    END as status
UNION ALL
SELECT 
    'STABLE Auth Functions' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = '_get_current_user_id' 
            AND prosecdef = true 
            AND provolatile = 's'
        ) AND EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = '_get_current_user_role' 
            AND prosecdef = true 
            AND provolatile = 's'
        ) AND EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname = '_get_current_vendor_id' 
            AND prosecdef = true 
            AND provolatile = 's'
        ) THEN '✅ ALL CREATED'
        ELSE '⚠️ MISSING'
    END as status
UNION ALL
SELECT 
    'RLS Policies Updated' as check_name,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
            AND (
                qual::text LIKE '%auth.uid()%' 
                OR with_check::text LIKE '%auth.uid()%'
            )
        ) THEN '✅ ALL UPDATED'
        ELSE '⚠️ SOME NOT UPDATED'
    END as status;

-- Expected: All checks should show ✅ status

