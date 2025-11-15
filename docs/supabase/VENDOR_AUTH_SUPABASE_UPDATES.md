# Supabase Updates for Vendor Authentication Fixes

## Overview

The vendor authentication flow fixes require **one database migration** to ensure optimal performance and correct role handling. The existing schema is mostly compatible, but we need to:

1. **Update the role constraint** to include the `'owner'` role
2. **Add a composite index** for faster vendor status queries
3. **Verify RLS policies** are correctly configured

## Required Migration

### File: `docs/supabase/20250126_vendor_auth_fixes.sql`

**Execute this migration in Supabase SQL Editor** to ensure the database schema supports the authentication fixes.

### What This Migration Does

1. **Updates Role Constraint**
   - Adds `'owner'` to the allowed roles in `profiles.role`
   - Previous constraint: `('user', 'vendor', 'admin')`
   - New constraint: `('user', 'vendor', 'admin', 'owner')`

2. **Adds Composite Index**
   - Creates index on `vendor_requests(user_id, status, created_at DESC)`
   - Optimizes the `checkVendorStatus()` query pattern
   - Improves performance when checking for approved vendor requests

3. **Verifies RLS Policies**
   - Ensures the "Vendor requests select by owner" policy exists
   - Confirms users can read their own vendor requests
   - Critical for `checkVendorStatus()` to work correctly

## Current Schema Status

### ✅ Already Configured (No Changes Needed)

1. **`vendor_requests` table**
   - ✅ Table exists with correct structure
   - ✅ `user_id` references `profiles.id`
   - ✅ `status` column with check constraint
   - ✅ Indexes on `user_id` and `status` exist
   - ✅ RLS is enabled

2. **`profiles` table**
   - ✅ `role` column exists with default `'user'`
   - ✅ Index on `role` exists (from previous migration)
   - ✅ RLS policies allow users to read/update their own profiles

3. **RLS Policies**
   - ✅ "Vendor requests select by owner" policy exists
   - ✅ Policy allows: `auth.uid() = user_id`
   - ✅ This matches the query pattern in `checkVendorStatus()`

## Verification Steps

After running the migration, verify the changes:

### 1. Check Role Constraint

```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND conname = 'profiles_role_check';
```

**Expected Result**: `role IN ('user', 'vendor', 'admin', 'owner')`

### 2. Check Composite Index

```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'vendor_requests'
  AND indexname = 'vendor_requests_user_id_status_created_idx';
```

**Expected Result**: Index exists on `(user_id, status, created_at DESC)`

### 3. Check RLS Policy

```sql
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'vendor_requests'
  AND policyname = 'Vendor requests select by owner';
```

**Expected Result**: 
- `policyname`: `Vendor requests select by owner`
- `cmd`: `SELECT`
- `qual`: `(auth.uid() = user_id)`

## How This Supports the Authentication Fixes

### Task A1: Session Hydration from Vendor Requests

The `checkVendorStatus()` function queries `vendor_requests` to check if a user has an approved vendor request. The migration ensures:

- ✅ RLS policy allows users to read their own requests
- ✅ Composite index optimizes the query performance
- ✅ Role constraint allows `'vendor'` role to be set

### Task A2: Session Persistence

No database changes needed. Cookie and localStorage persistence is handled client-side.

### Task A3: Bootstrap Profile Role Detection

The role constraint update ensures that when `buildBootstrapProfile()` sets `role='vendor'`, the database will accept it.

### Task B1-B3: Route Protection

No database changes needed. Route protection is handled client-side and in middleware.

### Task C1: Server-Side Session Sync

No database changes needed. Session sync is handled via API routes.

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove composite index
DROP INDEX IF EXISTS vendor_requests_user_id_status_created_idx;

-- Revert role constraint (remove 'owner')
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'vendor', 'admin'));
```

**Note**: Rolling back the role constraint will prevent users with `role='owner'` from being saved. Only rollback if you're certain no profiles have the `'owner'` role.

## Summary

**Required Action**: Run the migration file `docs/supabase/20250126_vendor_auth_fixes.sql` in Supabase SQL Editor.

**Impact**: 
- ✅ Low risk (adds index, updates constraint, verifies policies)
- ✅ Improves query performance
- ✅ Ensures role constraint matches application code
- ✅ No data loss or breaking changes

**Timing**: Can be run at any time. The application will continue to work without it, but the composite index will improve performance for vendor status checks.

