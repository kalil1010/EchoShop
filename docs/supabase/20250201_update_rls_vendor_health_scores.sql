-- ------------------------------------------------------------------
-- Update RLS policies for vendor_health_scores table
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid().
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_health_scores ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all health scores
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view all health scores" ON public.vendor_health_scores;
CREATE POLICY "Admins can view all health scores"
  ON public.vendor_health_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Vendors can view their own health score
DROP POLICY IF EXISTS "Vendors can view their own health score" ON public.vendor_health_scores;
CREATE POLICY "Vendors can view their own health score"
  ON public.vendor_health_scores
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Service can manage health scores (no change - uses true for service role)
DROP POLICY IF EXISTS "Service can manage health scores" ON public.vendor_health_scores;
CREATE POLICY "Service can manage health scores"
  ON public.vendor_health_scores
  FOR ALL
  WITH CHECK (true); -- Service role bypasses RLS

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
AND tablename = 'vendor_health_scores'
ORDER BY policyname;

