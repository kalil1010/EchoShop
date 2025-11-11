-- ------------------------------------------------------------------
-- Auto-create profiles trigger for unified login flow
-- ------------------------------------------------------------------
-- This trigger ensures that whenever a new user is created in auth.users,
-- a corresponding profile is automatically created in public.profiles with
-- a default role of 'user'. This supports the unified login flow where
-- users can sign in via any method (email/password, OAuth, etc.) and
-- will always have a profile available.

-- Function to handle new user creation
-- Note: This function must be created with security definer to bypass RLS
-- when inserting into profiles table
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    'user', -- Default role for all new users
    now(),
    now()
  )
  on conflict (id) do nothing; -- Prevent errors if profile already exists
  
  return new;
end;
$$;

-- Drop existing trigger if it exists (to allow re-running this migration)
-- Note: Creating triggers on auth.users requires superuser privileges
-- If this fails, you may need to use Supabase Dashboard → Database → Functions
-- or contact Supabase support to enable trigger creation on auth schema
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger that fires after a new user is inserted into auth.users
-- IMPORTANT: This may require superuser privileges. If it fails, consider:
-- 1. Using Supabase Database Webhooks instead (Dashboard → Database → Webhooks)
-- 2. Handling profile creation entirely in the application layer (current approach)
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Grant necessary permissions
grant usage on schema public to postgres, anon, authenticated, service_role;
grant execute on function public.handle_new_user() to postgres, anon, authenticated, service_role;

