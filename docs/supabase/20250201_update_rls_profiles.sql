-- ------------------------------------------------------------------
-- Update RLS policies for profiles table
-- ------------------------------------------------------------------
-- Phase 4.1: Priority 1 - Core User Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. This allows PostgreSQL to cache the auth context within
-- a transaction instead of re-evaluating it for every row.
-- ------------------------------------------------------------------

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (public._get_current_user_id() = id);

-- Policy: Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = id);

-- Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (public._get_current_user_id() = id)
  WITH CHECK (public._get_current_user_id() = id);

-- Policy: Public profiles are viewable by everyone (no change - uses true)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

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
AND tablename = 'profiles'
ORDER BY policyname;

-- Expected: All policies should use public._get_current_user_id() 
-- instead of auth.uid() where applicable

