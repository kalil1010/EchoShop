-- ------------------------------------------------------------------
-- Update RLS policies for follows table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all follows (no change - uses true)
DROP POLICY IF EXISTS "Users can view all follows" ON public.follows;
CREATE POLICY "Users can view all follows"
  ON public.follows
  FOR SELECT
  USING (true);

-- Policy: Users can create their own follows
DROP POLICY IF EXISTS "Users can create their own follows" ON public.follows;
CREATE POLICY "Users can create their own follows"
  ON public.follows
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = follower_id);

-- Policy: Users can delete their own follows
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;
CREATE POLICY "Users can delete their own follows"
  ON public.follows
  FOR DELETE
  USING (public._get_current_user_id() = follower_id);

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
AND tablename = 'follows'
ORDER BY policyname;

