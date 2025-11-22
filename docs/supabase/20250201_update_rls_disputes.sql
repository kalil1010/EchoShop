-- ------------------------------------------------------------------
-- Update RLS policies for disputes table
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid().
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all disputes
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.disputes;
CREATE POLICY "Admins can view all disputes"
  ON public.disputes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Customers can view their disputes
DROP POLICY IF EXISTS "Customers can view their disputes" ON public.disputes;
CREATE POLICY "Customers can view their disputes"
  ON public.disputes
  FOR SELECT
  USING (public._get_current_user_id() = customer_id);

-- Policy: Vendors can view their disputes
DROP POLICY IF EXISTS "Vendors can view their disputes" ON public.disputes;
CREATE POLICY "Vendors can view their disputes"
  ON public.disputes
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Service can manage disputes (no change - uses true)
DROP POLICY IF EXISTS "Service can manage disputes" ON public.disputes;
CREATE POLICY "Service can manage disputes"
  ON public.disputes
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
AND tablename = 'disputes'
ORDER BY policyname;

