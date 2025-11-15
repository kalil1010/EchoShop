# Supabase Developer Prompt: Unified Login Flow Updates

## Context
Echo Shop has implemented a unified login flow where users enter credentials once and are automatically routed to their role-specific dashboard based on their profile role (`user`, `vendor`, or `admin`/`owner`). The application needs Supabase database and configuration updates to support this flow reliably.

## Required Actions

### 1. Apply Database Trigger for Auto-Profile Creation (Optional but Recommended)

**File to execute**: `docs/supabase/20250125_auto_create_profiles_trigger.sql`

**What it does**: Creates a database trigger that automatically creates a profile in `public.profiles` with default role `'user'` whenever a new user is inserted into `auth.users`. This ensures profiles exist even for OAuth users or users created directly in Supabase Auth.

**Action**: 
- Open the SQL file and execute it in Supabase SQL Editor
- If you get a permission error creating the trigger on `auth.users`, that's okay - the application already handles profile creation, so this is just a safety net. Skip this step if it fails.

**Expected Result**: 
- Function `public.handle_new_user()` created
- Trigger `on_auth_user_created` on `auth.users` created (if permissions allow)

### 2. Verify Role Column Default Value

**Purpose**: Ensure new profiles automatically get role `'user'` if not specified.

**Verification Query**:
```sql
SELECT 
  column_name, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name = 'role';
```

**Expected**: `column_default` should be `'user'::text`

**If Missing**: Run:
```sql
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';
```

### 3. Verify Role Constraint

**Purpose**: Ensure only valid roles (`'user'`, `'vendor'`, `'admin'`) are allowed.

**Verification Query**:
```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname LIKE '%role%';
```

**Expected**: Constraint `profiles_role_check` with check `role IN ('user', 'vendor', 'admin')`

**If Missing**: Run:
```sql
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'vendor', 'admin'));
```

### 4. Verify RLS Policies

**Purpose**: Ensure users can create and manage their own profiles.

**Verification Query**:
```sql
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

**Required Policies**:
1. `Users can view their own profile` (SELECT)
2. `Users can insert their own profile` (INSERT)
3. `Users can update their own profile` (UPDATE)
4. `Public profiles are viewable by everyone` (SELECT)

**If Missing**: Execute `docs/supabase/20250124_profiles_rls_policies.sql`

### 5. Update Supabase Auth Configuration

**Location**: Supabase Dashboard → Authentication → URL Configuration

**Update Site URL**:
- Set to: `https://www.echoshop.ai` (or `https://echoshop.ai` if preferred)

**Update Redirect URLs** (add these):
- `https://www.echoshop.ai/**`
- `https://echoshop.ai/**`
- `http://localhost:3000/**` (for local development)

**Purpose**: Ensure OAuth redirects and email confirmations work with the new domain.

### 6. Verify Cloudflare Turnstile Configuration

**Location**: Supabase Dashboard → Authentication → Providers → Email

**Verify**:
- Cloudflare Turnstile is enabled
- Site Key matches the application's `NEXT_PUBLIC_TURNSTILE_SITE_KEY` environment variable
- Secret Key is configured in Supabase environment variables

**Purpose**: CAPTCHA verification is required for sign-up to prevent abuse.

## Testing Checklist

After applying updates, please verify:

1. ✅ **New User Sign-Up**: Create a test user via email/password. Verify profile is created with role `'user'`.

2. ✅ **OAuth Sign-In**: If OAuth is configured, test Google sign-in. Verify profile is created automatically.

3. ✅ **Existing Users**: Query existing profiles to ensure they have valid roles:
   ```sql
   SELECT id, email, role 
   FROM public.profiles 
   WHERE role IS NULL OR role NOT IN ('user', 'vendor', 'admin');
   ```
   If any rows are returned, update them:
   ```sql
   UPDATE public.profiles 
   SET role = 'user' 
   WHERE role IS NULL OR role NOT IN ('user', 'vendor', 'admin');
   ```

4. ✅ **Trigger Test** (if trigger was created): Manually insert a test user in `auth.users` (if possible) and verify profile is auto-created.

## Files Reference

All SQL files are located in: `docs/supabase/`

- `20250125_auto_create_profiles_trigger.sql` - Auto-profile creation trigger
- `20250124_profiles_rls_policies.sql` - RLS policies (should already be applied)
- `20251019_vendor_products.sql` - Role column setup (should already be applied)

## Questions or Issues?

If you encounter any permission errors or need clarification on any step, please note:
- The application already handles profile creation in the code, so the trigger is optional
- RLS policies and role constraints are the most critical items
- Auth URL configuration is required for production deployment

## Completion Criteria

✅ All verification queries return expected results  
✅ Auth configuration updated with new domain  
✅ Cloudflare Turnstile verified  
✅ Test user sign-up creates profile successfully  
✅ No errors in Supabase logs related to profile creation

---

**Priority**: High - Required for unified login flow to work reliably in production.





