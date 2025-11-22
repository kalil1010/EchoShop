-- ------------------------------------------------------------------
-- Update RLS policies for comments table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view non-deleted comments (no change - uses deleted_at check)
DROP POLICY IF EXISTS "Users can view non-deleted comments" ON public.comments;
CREATE POLICY "Users can view non-deleted comments"
  ON public.comments
  FOR SELECT
  USING (deleted_at IS NULL);

-- Policy: Users can create their own comments
DROP POLICY IF EXISTS "Users can create their own comments" ON public.comments;
CREATE POLICY "Users can create their own comments"
  ON public.comments
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can update their own comments
DROP POLICY IF EXISTS "Users can update their own comments" ON public.comments;
CREATE POLICY "Users can update their own comments"
  ON public.comments
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can delete their own comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments"
  ON public.comments
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
AND tablename = 'comments'
ORDER BY policyname;

