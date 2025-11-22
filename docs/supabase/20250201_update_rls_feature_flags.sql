-- ------------------------------------------------------------------
-- Update RLS policies for feature_flags and feature_flag_assignments tables
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid().
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_assignments ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- Feature Flags Policies
-- ------------------------------------------------------------------

-- Policy: Admins can view all feature flags
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view all feature flags" ON public.feature_flags;
CREATE POLICY "Admins can view all feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Service can manage feature flags (no change - uses true)
DROP POLICY IF EXISTS "Service can manage feature flags" ON public.feature_flags;
CREATE POLICY "Service can manage feature flags"
  ON public.feature_flags
  FOR ALL
  WITH CHECK (true); -- Service role bypasses RLS

-- Policy: Vendors can check feature flags (no change - uses true)
DROP POLICY IF EXISTS "Vendors can check feature flags" ON public.feature_flags;
CREATE POLICY "Vendors can check feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (true); -- Public read access for checking flags

-- ------------------------------------------------------------------
-- Feature Flag Assignments Policies
-- ------------------------------------------------------------------

-- Policy: Service can manage assignments (no change - uses true)
DROP POLICY IF EXISTS "Service can manage assignments" ON public.feature_flag_assignments;
CREATE POLICY "Service can manage assignments"
  ON public.feature_flag_assignments
  FOR ALL
  WITH CHECK (true); -- Service role bypasses RLS

-- Policy: Vendors can view their own assignments
DROP POLICY IF EXISTS "Vendors can view their assignments" ON public.feature_flag_assignments;
CREATE POLICY "Vendors can view their assignments"
  ON public.feature_flag_assignments
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

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
AND tablename IN ('feature_flags', 'feature_flag_assignments')
ORDER BY tablename, policyname;

