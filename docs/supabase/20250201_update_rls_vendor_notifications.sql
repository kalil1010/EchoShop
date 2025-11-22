-- ------------------------------------------------------------------
-- Update RLS policies for vendor_notifications table
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their notifications
DROP POLICY IF EXISTS "Users can view their notifications" ON public.vendor_notifications;
CREATE POLICY "Users can view their notifications"
  ON public.vendor_notifications
  FOR SELECT
  USING (public._get_current_user_id() = user_id);

-- Policy: Service can insert notifications (no change - uses true for service role)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.vendor_notifications;
CREATE POLICY "Service can insert notifications"
  ON public.vendor_notifications
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Policy: Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their notifications" ON public.vendor_notifications;
CREATE POLICY "Users can update their notifications"
  ON public.vendor_notifications
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (public._get_current_user_id() = user_id);

-- Verification Query
-- ------------------------------------------------------------------
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'vendor_notifications'
ORDER BY policyname;

