-- ------------------------------------------------------------------
-- Fix #2: Add SECURITY DEFINER and SET search_path to all functions
-- ------------------------------------------------------------------
-- Phase 2.2: Function Security Settings
--
-- This fix addresses the security warnings where PostgreSQL functions
-- in the public schema lack SECURITY DEFINER and SET search_path = public.
--
-- Risk: Functions execute with caller's search_path, breaking query planner
-- Fix: Add SECURITY DEFINER and SET search_path = public to all functions
--
-- Note: Run Query 2 from pre_deployment_verification.sql first to identify
-- which functions actually need updates. Some may already have these settings.
-- ------------------------------------------------------------------

-- Batch 1: Trigger Functions (Touch/Update Timestamps)
-- ------------------------------------------------------------------
ALTER FUNCTION public.touch_orders_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_order_items_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_posts_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_comments_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_collections_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_communities_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_challenges_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_vendor_requests_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.touch_vendor_assistants_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_message_templates_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_broadcast_messages_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_disputes_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_alert_rules_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_alerts_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_feature_flags_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_vendor_health_scores_updated_at() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_vendor_payouts_updated_at() SECURITY DEFINER SET search_path = public;

-- Batch 2: Query/Aggregation Functions
-- ------------------------------------------------------------------
ALTER FUNCTION public.get_user_feed(uuid, integer, integer) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_post_likes_count(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_post_comments_count(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_post_engagement(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_trending_hashtags(integer, integer) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_trending_posts(integer, integer) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_user_collections(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_conversation_messages(uuid, uuid, integer, integer) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_vendor_ticket_stats(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_vendor_activity_stats(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_audit_log_stats(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_enabled_features(uuid) SECURITY DEFINER SET search_path = public;

-- Batch 3: Notification & Utility Functions
-- ------------------------------------------------------------------
ALTER FUNCTION public.extract_hashtags(text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.notify_on_like() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.notify_on_comment() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.notify_on_follow() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_hashtag_post_count() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.extract_and_create_hashtags() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_profile_posts_count() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_profile_follow_counts() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_community_member_count() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_challenge_submission_count() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.generate_order_number() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.generate_payout_number() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.cleanup_expired_notifications() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.notify_product_moderation_change() SECURITY DEFINER SET search_path = public;

-- Batch 4: Business Logic Functions
-- ------------------------------------------------------------------
ALTER FUNCTION public.calculate_pending_payout(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_vendor_payout_summary(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.hold_vendor_payout(uuid, text) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.release_vendor_payout(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.update_payout_compliance(uuid, jsonb) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.calculate_vendor_health_score(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.refresh_vendor_health_summary() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.log_vendor_activity(uuid, text, jsonb) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.create_audit_log(uuid, text, text, jsonb) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.cleanup_expired_audit_logs() SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.create_alert(uuid, text, text, jsonb) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_feature_enabled(text, uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.add_dispute_timeline_event(uuid, text, text, jsonb) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_unread_notification_count(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.mark_all_notifications_read(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.create_vendor_notification(uuid, text, text, text, text, jsonb, timestamptz) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_or_create_conversation(uuid, uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_unread_message_count(uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_vendor_assistant(uuid, uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.get_vendor_assistant_role(uuid, uuid) SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.refresh_analytics_views() SECURITY DEFINER SET search_path = public;

-- Batch 5: User Management Functions
-- ------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = public;

-- Verification Query
-- ------------------------------------------------------------------
-- Run this query to verify all functions have SECURITY DEFINER and search_path set
SELECT 
    p.proname as function_name,
    p.prosecdef as has_security_definer,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN true 
        ELSE false 
    END as has_search_path,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'  -- Exclude our new STABLE functions
ORDER BY p.proname;

-- Expected Result: All functions should have:
-- - has_security_definer = true
-- - has_search_path = true

