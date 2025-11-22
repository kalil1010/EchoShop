-- ------------------------------------------------------------------
-- Update RLS policies for vendor_requests table
-- ------------------------------------------------------------------
-- Phase 4.1: Priority 1 - Core User Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Vendor requests select by owner
DROP POLICY IF EXISTS "Vendor requests select by owner" ON public.vendor_requests;
CREATE POLICY "Vendor requests select by owner"
  ON public.vendor_requests
  FOR SELECT
  USING (public._get_current_user_id() = user_id);

-- Policy: Vendor requests insert by owner
DROP POLICY IF EXISTS "Vendor requests insert by owner" ON public.vendor_requests;
CREATE POLICY "Vendor requests insert by owner"
  ON public.vendor_requests
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Vendor requests update by owner
DROP POLICY IF EXISTS "Vendor requests update by owner" ON public.vendor_requests;
CREATE POLICY "Vendor requests update by owner"
  ON public.vendor_requests
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (public._get_current_user_id() = user_id);

-- Note: Admin policies for viewing all requests may exist separately
-- Check for additional admin policies that need updating

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
AND tablename = 'vendor_requests'
ORDER BY policyname;

