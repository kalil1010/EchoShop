-- ------------------------------------------------------------------
-- Update RLS policies for collections table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view public or own collections
DROP POLICY IF EXISTS "Users can view public or own collections" ON public.collections;
CREATE POLICY "Users can view public or own collections"
  ON public.collections
  FOR SELECT
  USING (is_public = true OR public._get_current_user_id() = user_id);

-- Policy: Users can create their own collections
DROP POLICY IF EXISTS "Users can create their own collections" ON public.collections;
CREATE POLICY "Users can create their own collections"
  ON public.collections
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can update their own collections
DROP POLICY IF EXISTS "Users can update their own collections" ON public.collections;
CREATE POLICY "Users can update their own collections"
  ON public.collections
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can delete their own collections
DROP POLICY IF EXISTS "Users can delete their own collections" ON public.collections;
CREATE POLICY "Users can delete their own collections"
  ON public.collections
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
AND tablename = 'collections'
ORDER BY policyname;

