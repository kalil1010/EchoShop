-- ------------------------------------------------------------------
-- Update RLS policies for posts table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note that the posts policy has nested auth.uid() calls
-- in the EXISTS subquery, so all instances need to be updated.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view public posts
-- This policy has nested auth.uid() calls that all need updating
DROP POLICY IF EXISTS "Users can view public posts" ON public.posts;
CREATE POLICY "Users can view public posts"
  ON public.posts
  FOR SELECT
  USING (
    deleted_at IS NULL AND (
      privacy_level = 'public' OR
      (privacy_level = 'followers' AND (
        public._get_current_user_id() = user_id OR
        EXISTS (
          SELECT 1 FROM public.follows
          WHERE follower_id = public._get_current_user_id() 
          AND following_id = posts.user_id
        )
      )) OR
      (privacy_level = 'private' AND public._get_current_user_id() = user_id)
    )
  );

-- Policy: Users can create their own posts
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can update their own posts
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can delete their own posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
  ON public.posts
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
AND tablename = 'posts'
ORDER BY policyname;

