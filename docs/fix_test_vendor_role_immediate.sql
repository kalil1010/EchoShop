-- IMMEDIATE FIX: Update test vendor role in database
-- Run this NOW to fix the current session
-- User: zein.zodiac@gmail.com
-- User ID: 086f7974-46be-4c83-bbe0-b15aa2383b9a

-- Update the profile role to 'vendor' to match auth metadata
UPDATE public.profiles
SET 
  role = 'vendor',
  updated_at = timezone('utc', now())
WHERE id = '086f7974-46be-4c83-bbe0-b15aa2383b9a';

-- Verify the update
SELECT id, email, role, updated_at
FROM public.profiles
WHERE id = '086f7974-46be-4c83-bbe0-b15aa2383b9a';

-- After running this, refresh the browser page (F5) to see the change

