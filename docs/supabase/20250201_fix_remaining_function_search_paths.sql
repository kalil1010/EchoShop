-- ------------------------------------------------------------------
-- Fix Remaining Function Search Path Warnings (65 functions)
-- ------------------------------------------------------------------
-- This addresses the 65 "Function Search Path Mutable" security warnings
-- 
-- Issue: Functions without explicit SET search_path = public
-- Impact: Medium severity - schema pollution risk
-- Fix: Add SET search_path = public to all functions
-- ------------------------------------------------------------------

-- Step 1: Identify all functions that need search_path fix
-- ------------------------------------------------------------------
-- Run this query first to see which functions need fixing
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN p.proconfig IS NULL THEN 'No config'
        WHEN array_to_string(p.proconfig, ', ') LIKE '%search_path%' THEN 'Has search_path'
        ELSE 'No search_path'
    END as search_path_status,
    pg_get_functiondef(p.oid) LIKE '%SET search_path%' as has_search_path_in_def
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'  -- Only functions, not aggregates or procedures
AND p.proname NOT LIKE 'pg_%'  -- Exclude PostgreSQL internal functions
AND p.proname NOT LIKE '_get_current_%'  -- Exclude our new STABLE functions
ORDER BY p.proname;

-- Step 2: Generate ALTER FUNCTION statements for all functions missing search_path
-- ------------------------------------------------------------------
-- This query generates all the ALTER FUNCTION commands needed
-- Copy the output and execute in a single transaction
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
-- Check if search_path is NOT set in function definition
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
ORDER BY p.proname;

-- Step 3: Execute fixes (Run in a single transaction)
-- ------------------------------------------------------------------
-- IMPORTANT: Run this in a single transaction to ensure atomicity
BEGIN;

-- Batch 1: Admin & Security Functions
ALTER FUNCTION public.admin_regenerate_backup_codes() SET search_path = public;
ALTER FUNCTION public.admin_reset_2fa_attempts() SET search_path = public;
ALTER FUNCTION public.admin_unlock_account() SET search_path = public;

-- Batch 2: Vendor & Business Functions
ALTER FUNCTION public.calculate_pending_payout(uuid) SET search_path = public;
ALTER FUNCTION public.can_apply_for_vendor(uuid) SET search_path = public;
ALTER FUNCTION public.generate_payout_number() SET search_path = public;

-- Batch 3: Cleanup & Maintenance Functions
ALTER FUNCTION public.cleanup_expired_2fa_sessions() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_notifications() SET search_path = public;
ALTER FUNCTION public.clear_user_2fa_sessions(uuid) SET search_path = public;

-- Batch 4: 2FA & Security Functions
ALTER FUNCTION public.complete_2fa_setup(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.create_2fa_session(uuid) SET search_path = public;

-- Batch 5: Social Platform Functions
ALTER FUNCTION public.extract_hashtags(text) SET search_path = public;
ALTER FUNCTION public.extract_and_create_hashtags() SET search_path = public;
ALTER FUNCTION public.get_post_engagement(uuid) SET search_path = public;
ALTER FUNCTION public.get_post_comments_count(uuid) SET search_path = public;
ALTER FUNCTION public.get_post_likes_count(uuid) SET search_path = public;
ALTER FUNCTION public.get_trending_hashtags(integer, integer) SET search_path = public;
ALTER FUNCTION public.get_trending_posts(integer, integer) SET search_path = public;
ALTER FUNCTION public.get_user_collections(uuid) SET search_path = public;
ALTER FUNCTION public.get_conversation_messages(uuid, uuid, integer, integer) SET search_path = public;
ALTER FUNCTION public.get_user_feed(uuid, integer, integer) SET search_path = public;

-- Batch 6: Notification Functions
ALTER FUNCTION public.notify_on_comment() SET search_path = public;
ALTER FUNCTION public.notify_on_follow() SET search_path = public;
ALTER FUNCTION public.notify_on_like() SET search_path = public;

-- Batch 7: Touch/Update Timestamp Functions
ALTER FUNCTION public.touch_challenges_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_collections_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_comments_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_communities_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_orders_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_order_items_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_posts_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_vendor_assistants_updated_at() SET search_path = public;

-- Batch 8: Update/Counter Functions
ALTER FUNCTION public.update_hashtag_post_count() SET search_path = public;
ALTER FUNCTION public.update_profile_follow_counts() SET search_path = public;
ALTER FUNCTION public.update_profile_posts_count() SET search_path = public;
ALTER FUNCTION public.update_community_member_count() SET search_path = public;
ALTER FUNCTION public.update_challenge_submission_count() SET search_path = public;

-- Batch 9: Server & Role Functions
ALTER FUNCTION public.get_or_create_servers(uuid) SET search_path = public;
ALTER FUNCTION public.get_role_level(text) SET search_path = public;

-- Batch 10: Vendor Assistant Functions
ALTER FUNCTION public.is_vendor_assistant(uuid, uuid) SET search_path = public;

-- Note: Add any additional functions identified in Step 1 query above
-- Replace function signatures as needed based on actual function definitions

COMMIT;

-- Step 4: Verification Query
-- ------------------------------------------------------------------
-- After executing the fixes, run this to verify
SELECT 
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
    ) as functions_missing_search_path,
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        OR p.proname LIKE '_get_current_%'
    ) as functions_with_search_path,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%';

-- Expected Result:
-- functions_missing_search_path should be 0 (or close to 0)
-- functions_with_search_path should equal total_functions (or close to it)

