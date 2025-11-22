-- ------------------------------------------------------------------
-- Update RLS policies for vendor_owner_messages table
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_owner_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their messages
-- This policy checks both sender_id and recipient_id
DROP POLICY IF EXISTS "Users can view their messages" ON public.vendor_owner_messages;
CREATE POLICY "Users can view their messages"
  ON public.vendor_owner_messages
  FOR SELECT
  USING (
    public._get_current_user_id() = sender_id OR 
    public._get_current_user_id() = recipient_id
  );

-- Policy: Users can send messages
DROP POLICY IF EXISTS "Users can send messages" ON public.vendor_owner_messages;
CREATE POLICY "Users can send messages"
  ON public.vendor_owner_messages
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = sender_id);

-- Policy: Users can update received messages (mark as read)
DROP POLICY IF EXISTS "Users can update received messages" ON public.vendor_owner_messages;
CREATE POLICY "Users can update received messages"
  ON public.vendor_owner_messages
  FOR UPDATE
  USING (public._get_current_user_id() = recipient_id)
  WITH CHECK (public._get_current_user_id() = recipient_id);

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
AND tablename = 'vendor_owner_messages'
ORDER BY policyname;

