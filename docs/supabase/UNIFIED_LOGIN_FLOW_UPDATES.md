# Supabase Updates for Unified Login Flow

## Overview
This document outlines the Supabase database and configuration updates required to support Echo Shop's unified login flow, where users enter credentials once and are automatically routed to their role-specific dashboard.

## Required Updates

### 1. Database Trigger: Auto-Create Profiles (Optional but Recommended)
**File**: `docs/supabase/20250125_auto_create_profiles_trigger.sql`

**Purpose**: Automatically create a profile with default role 'user' when a new user is created in `auth.users`. This ensures that:
- OAuth users (Google, etc.) get profiles automatically
- Users created directly in Supabase Auth get profiles
- The unified login flow always has a profile to work with

**Action**: Run the SQL migration file `20250125_auto_create_profiles_trigger.sql` in the Supabase SQL Editor.

**Important Note**: Creating triggers on `auth.users` may require superuser privileges. If the trigger creation fails:
- **Option A**: Use Supabase Database Webhooks (Dashboard → Database → Webhooks) to call an API endpoint when users are created
- **Option B**: Rely on the application layer (already implemented in `AuthContext.tsx`) which handles profile creation during sign-up and sign-in

**Key Features** (if trigger creation succeeds):
- Trigger fires `AFTER INSERT` on `auth.users`
- Creates profile with default role `'user'`
- Uses `ON CONFLICT DO NOTHING` to prevent errors if profile already exists
- Runs with `security definer` to bypass RLS during creation

**Current Status**: The application already handles profile creation in `AuthContext.tsx` during sign-up and sign-in, so this trigger is a **safety net** rather than a requirement. The unified login flow will work without it, but having it provides an extra layer of reliability.

### 2. Verify Role Column Default Value
**File**: `docs/supabase/20251019_vendor_products.sql` (already applied)

**Purpose**: Ensure the `role` column in `public.profiles` has a default value of `'user'`.

**Verification Query**:
```sql
SELECT 
  column_name, 
  column_default, 
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'role';
```

**Expected Result**: `column_default` should be `'user'::text`

**If Missing**: Run this to add the default:
```sql
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';
```

### 3. Verify RLS Policies
**File**: `docs/supabase/20250124_profiles_rls_policies.sql` (already applied)

**Purpose**: Ensure Row Level Security policies allow:
- Users to insert their own profiles
- Users to read their own profiles
- Users to update their own profiles
- Public read access for marketplace features

**Verification Query**:
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

**Expected Policies**:
1. `Users can view their own profile` (SELECT, using `auth.uid() = id`)
2. `Users can insert their own profile` (INSERT, with check `auth.uid() = id`)
3. `Users can update their own profile` (UPDATE, using/with check `auth.uid() = id`)
4. `Public profiles are viewable by everyone` (SELECT, using `true`)

### 4. Verify Role Constraint
**Purpose**: Ensure the `role` column only accepts valid values: `'user'`, `'vendor'`, `'admin'`.

**Verification Query**:
```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname LIKE '%role%';
```

**Expected Constraint**: `profiles_role_check` with check `role IN ('user', 'vendor', 'admin')`

**If Missing**: Run this:
```sql
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'vendor', 'admin'));
```

### 5. Supabase Auth Configuration
**Location**: Supabase Dashboard → Authentication → URL Configuration

**Required Settings**:
- **Site URL**: `https://www.echoshop.ai` (or `https://echoshop.ai`)
- **Redirect URLs**: Add the following:
  - `https://www.echoshop.ai/**`
  - `https://echoshop.ai/**`
  - `http://localhost:3000/**` (for local development)

**Purpose**: Ensure OAuth redirects and email confirmations work correctly with the new domain.

### 6. Cloudflare Turnstile Configuration
**Location**: Supabase Dashboard → Authentication → Providers → Email

**Required Settings**:
- **Enable Cloudflare Turnstile**: Enabled
- **Site Key**: (Should match `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in your environment)
- **Secret Key**: (Configured in Supabase environment variables)

**Purpose**: CAPTCHA verification is required for sign-up to prevent abuse.

## Testing Checklist

After applying updates, verify:

1. **New User Sign-Up**:
   - Sign up a new user via email/password
   - Verify profile is created automatically with role `'user'`
   - Verify user is redirected to home page (`/`)

2. **OAuth Sign-In**:
   - Sign in with Google OAuth
   - Verify profile is created automatically with role `'user'`
   - Verify user is redirected to home page (`/`)

3. **Existing User Login**:
   - Sign in with existing account
   - Verify profile exists and role is preserved
   - Verify user is redirected to correct dashboard based on role:
     - `'user'` → `/`
     - `'vendor'` → `/atlas`
     - `'owner'` or `'admin'` → `/downtown/dashboard`

4. **Missing Profile Handling**:
   - Create a user directly in Supabase Auth (if possible)
   - Sign in with that user
   - Verify profile is created automatically with role `'user'`

5. **Role-Based Access**:
   - As a `'user'`, try to access `/atlas` or `/downtown`
   - Verify redirect to `/auth` with appropriate error message
   - Verify `AccessDeniedBanner` displays upgrade pathway

## Rollback Plan

If issues occur, you can disable the trigger:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

The frontend will still handle profile creation via `AuthContext.tsx`, but automatic creation will be disabled.

## Notes

- The trigger uses `ON CONFLICT DO NOTHING` to prevent errors if the frontend already created the profile
- The trigger runs with `security definer` to bypass RLS, but the profile it creates will still be subject to RLS policies for subsequent operations
- The default role is always `'user'` - role upgrades must be done manually by admins or through vendor application workflows

