-- ------------------------------------------------------------------
-- Update RLS policies for vendor_assistants and vendor_assistant_invitations tables
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Some policies have nested auth.uid() in subqueries.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_assistant_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_assistants ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- Vendor Assistant Invitations Policies
-- ------------------------------------------------------------------

-- Policy: Vendors can view their own invitations
DROP POLICY IF EXISTS "Vendors can view their own invitations" ON public.vendor_assistant_invitations;
CREATE POLICY "Vendors can view their own invitations"
  ON public.vendor_assistant_invitations
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Vendors can create invitations
DROP POLICY IF EXISTS "Vendors can create invitations" ON public.vendor_assistant_invitations;
CREATE POLICY "Vendors can create invitations"
  ON public.vendor_assistant_invitations
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = vendor_id);

-- Policy: Vendors can update their own invitations
DROP POLICY IF EXISTS "Vendors can update their own invitations" ON public.vendor_assistant_invitations;
CREATE POLICY "Vendors can update their own invitations"
  ON public.vendor_assistant_invitations
  FOR UPDATE
  USING (public._get_current_user_id() = vendor_id)
  WITH CHECK (public._get_current_user_id() = vendor_id);

-- Policy: Users can view their own invitations
-- This policy has nested auth.uid() in subquery
DROP POLICY IF EXISTS "Users can view their own invitations" ON public.vendor_assistant_invitations;
CREATE POLICY "Users can view their own invitations"
  ON public.vendor_assistant_invitations
  FOR SELECT
  USING (
    invited_email = (SELECT email FROM auth.users WHERE id = public._get_current_user_id())
    OR public._get_current_user_id() = vendor_id
  );

-- ------------------------------------------------------------------
-- Vendor Assistants Policies
-- ------------------------------------------------------------------

-- Policy: Vendors can view their assistants
DROP POLICY IF EXISTS "Vendors can view their assistants" ON public.vendor_assistants;
CREATE POLICY "Vendors can view their assistants"
  ON public.vendor_assistants
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Assistants can view their own assignments
DROP POLICY IF EXISTS "Assistants can view their assignments" ON public.vendor_assistants;
CREATE POLICY "Assistants can view their assignments"
  ON public.vendor_assistants
  FOR SELECT
  USING (public._get_current_user_id() = assistant_id);

-- Policy: Vendors can manage their assistants
DROP POLICY IF EXISTS "Vendors can manage their assistants" ON public.vendor_assistants;
CREATE POLICY "Vendors can manage their assistants"
  ON public.vendor_assistants
  FOR ALL
  USING (public._get_current_user_id() = vendor_id)
  WITH CHECK (public._get_current_user_id() = vendor_id);

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
AND tablename IN ('vendor_assistants', 'vendor_assistant_invitations')
ORDER BY tablename, policyname;

