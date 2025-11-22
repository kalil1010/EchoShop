-- ------------------------------------------------------------------
-- Update RLS policies for saves table
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own saves
DROP POLICY IF EXISTS "Users can view their own saves" ON public.saves;
CREATE POLICY "Users can view their own saves"
  ON public.saves
  FOR SELECT
  USING (public._get_current_user_id() = user_id);

-- Policy: Users can create their own saves
DROP POLICY IF EXISTS "Users can create their own saves" ON public.saves;
CREATE POLICY "Users can create their own saves"
  ON public.saves
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Users can delete their own saves
DROP POLICY IF EXISTS "Users can delete their own saves" ON public.saves;
CREATE POLICY "Users can delete their own saves"
  ON public.saves
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
AND tablename = 'saves'
ORDER BY policyname;

