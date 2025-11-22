-- ------------------------------------------------------------------
-- Update RLS policies for likes table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all likes (no change - uses true)
DROP POLICY IF EXISTS "Users can view all likes" ON public.likes;
CREATE POLICY "Users can view all likes"
  ON public.likes
  FOR SELECT
  USING (true);

-- Policy: Users can create their own likes
DROP POLICY IF EXISTS "Users can create their own likes" ON public.likes;
CREATE POLICY "Users can create their own likes"
  ON public.likes
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can delete their own likes
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;
CREATE POLICY "Users can delete their own likes"
  ON public.likes
  FOR DELETE
  USING (public._get_current_user_id() = user_id);

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
AND tablename = 'likes'
ORDER BY policyname;

