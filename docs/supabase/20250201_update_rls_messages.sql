-- ------------------------------------------------------------------
-- Update RLS policies for messages table (social platform)
-- ------------------------------------------------------------------
-- Phase 4.2: Priority 2 - Social Platform Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: This is the social platform messages table, separate
-- from vendor_owner_messages.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own messages
-- This policy checks both sender_id and recipient_id
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
CREATE POLICY "Users can view their own messages"
  ON public.messages
  FOR SELECT
  USING (
    public._get_current_user_id() = sender_id OR 
    public._get_current_user_id() = recipient_id
  );

-- Policy: Users can send messages
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = sender_id);

-- Policy: Users can update their received messages (mark as read)
DROP POLICY IF EXISTS "Users can update their received messages" ON public.messages;
CREATE POLICY "Users can update their received messages"
  ON public.messages
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
AND tablename = 'messages'
ORDER BY policyname;

