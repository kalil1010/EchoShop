-- Fix test vendor role for user: zein.zodiac@gmail.com
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

