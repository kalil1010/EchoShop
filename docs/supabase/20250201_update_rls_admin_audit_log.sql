-- ------------------------------------------------------------------
-- Update RLS policies for admin_audit_log table
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid().
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view audit logs
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs"
  ON public.admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Service can insert audit logs (no change - uses true for service role)
DROP POLICY IF EXISTS "Service can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Service can insert audit logs"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- Note: Updates and deletes are prevented by not having UPDATE/DELETE policies

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
AND tablename = 'admin_audit_log'
ORDER BY policyname;

