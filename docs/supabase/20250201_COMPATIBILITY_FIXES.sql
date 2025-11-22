-- ------------------------------------------------------------------
-- Compatibility Fixes - Version Detection and Adaptations
-- ------------------------------------------------------------------
-- Run this file FIRST to check compatibility and identify any issues
-- before running the main migration files.
-- ------------------------------------------------------------------

-- Step 1: Check PostgreSQL Version
-- ------------------------------------------------------------------
SELECT 
    version() as full_version,
    current_setting('server_version_num')::int as version_number,
    CASE 
        WHEN current_setting('server_version_num')::int >= 150000 
        THEN 'PostgreSQL 15+'
        WHEN current_setting('server_version_num')::int >= 140000 
        THEN 'PostgreSQL 14'
        WHEN current_setting('server_version_num')::int >= 130000 
        THEN 'PostgreSQL 13'
        ELSE 'PostgreSQL < 13'
    END as version_category;

-- Step 2: Check Feature Support
-- ------------------------------------------------------------------
SELECT 
    'security_invoker on views' as feature,
    CASE 
        WHEN current_setting('server_version_num')::int >= 150000 
        THEN '✅ Supported'
        ELSE '❌ NOT Supported (requires PostgreSQL 15+)'
    END as status,
    '20250201_fix_security_view.sql will skip automatically' as note
UNION ALL
SELECT 
    'SECURITY DEFINER functions' as feature,
    '✅ Supported' as status,
    'Works on all versions' as note
UNION ALL
SELECT 
    'STABLE functions' as feature,
    '✅ Supported' as status,
    'Works on all versions' as note
UNION ALL
SELECT 
    'RLS policies' as feature,
    '✅ Supported' as status,
    'Works on all versions' as note;

-- Step 3: Check pg_stat_statements Extension
-- ------------------------------------------------------------------
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')
        THEN '✅ Installed'
        ELSE '❌ NOT Installed (optional - not required for deployment)'
    END as pg_stat_statements_status;

-- Step 4: Check pg_stat_statements Column Names
-- ------------------------------------------------------------------
-- This determines which query to use in pre-deployment verification
DO $$
DECLARE
    has_new_columns boolean;
    has_old_columns boolean;
BEGIN
    -- Check for PostgreSQL 14+ column names
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'pg_catalog' 
        AND table_name = 'pg_stat_user_functions'
        AND column_name = 'total_exec_time'
    ) INTO has_new_columns;
    
    -- Check for PostgreSQL 13 column names
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'pg_catalog' 
        AND table_name = 'pg_stat_user_functions'
        AND column_name = 'total_time'
    ) INTO has_old_columns;
    
    IF has_new_columns THEN
        RAISE NOTICE 'Use Query 8a in pre-deployment_verification.sql (PostgreSQL 14+ columns)';
    ELSIF has_old_columns THEN
        RAISE NOTICE 'Use Query 8b in pre-deployment_verification.sql (PostgreSQL 13 columns)';
    ELSE
        RAISE NOTICE 'pg_stat_statements columns not found - extension may not be installed';
    END IF;
END $$;

-- Step 5: Check if security_dashboard_stats View Exists
-- ------------------------------------------------------------------
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'security_dashboard_stats'
        )
        THEN '✅ View exists - Fix #1 will attempt to update it'
        ELSE 'ℹ️ View does not exist - Fix #1 will skip automatically'
    END as security_dashboard_stats_status;

-- Step 6: Summary and Recommendations
-- ------------------------------------------------------------------
SELECT 
    '=== COMPATIBILITY SUMMARY ===' as summary
UNION ALL
SELECT 
    CASE 
        WHEN current_setting('server_version_num')::int >= 150000 
        THEN '✅ All migration files are fully compatible with your PostgreSQL version'
        WHEN current_setting('server_version_num')::int >= 140000 
        THEN '⚠️ Most files compatible. security_invoker feature will be skipped (safe)'
        WHEN current_setting('server_version_num')::int >= 130000 
        THEN '⚠️ Most files compatible. security_invoker feature will be skipped (safe). Check pg_stat_statements column names.'
        ELSE '❌ PostgreSQL version too old. Consider upgrading to PostgreSQL 13+'
    END as recommendation;

