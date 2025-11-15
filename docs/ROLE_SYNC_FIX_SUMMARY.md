# Role Sync Fix - Summary

## Overview
This fix ensures that user roles in the `profiles` table are automatically synced from `auth.users` metadata on every login, preventing role mismatches.

## What Was Fixed

### 1. Code Changes (`src/contexts/AuthContext.tsx`)
- Added `shouldUpgradeRole()` function to determine role hierarchy
- Enhanced `reconcileProfileAfterAuth()` to sync roles from auth metadata
- Only upgrades roles (never downgrades) for security

### 2. Role Hierarchy
```
user (level 1) < vendor (level 2) < owner/admin (level 3)
```

### 3. Supported Role Types
✅ **All role types are supported:**
- `user` → `vendor` (upgrade)
- `user` → `owner` (upgrade)
- `user` → `admin` (upgrade, normalized to `owner`)
- `vendor` → `owner` (upgrade)
- `vendor` → `admin` (upgrade, normalized to `owner`)

❌ **Downgrades are blocked for security:**
- `vendor` → `user` (blocked)
- `owner` → `vendor` (blocked)
- `owner` → `user` (blocked)

## Database Migration Required

### Run This Migration:
**File:** `docs/supabase/20250127_role_sync_fix.sql`

This migration:
1. ✅ Updates role constraint to include `'owner'` role
2. ✅ One-time sync of existing users' roles from auth metadata
3. ✅ Creates index on role column for performance
4. ✅ Only upgrades roles (never downgrades)

### How to Apply:
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `docs/supabase/20250127_role_sync_fix.sql`
3. Run the migration
4. Check the output for how many users were updated

## How It Works

### On Every Login:
1. User authenticates (via email/password or OAuth)
2. `AuthContext` loads user profile from `profiles` table
3. `reconcileProfileAfterAuth()` is called which:
   - Checks for approved vendor requests (existing behavior)
   - **NEW:** Checks auth metadata for role
   - **NEW:** If auth role is higher, upgrades profile role
   - Updates database if role changed
4. User session uses the synced role

### Example Scenarios:

**Scenario 1: New Vendor via OAuth**
- User logs in with Google OAuth
- Auth metadata has `role: "vendor"`
- Profile has `role: "user"`
- ✅ System upgrades profile to `vendor` automatically

**Scenario 2: Admin Updates Role**
- Admin updates user's role in auth metadata to `vendor`
- User logs in next time
- ✅ System syncs role to profile automatically

**Scenario 3: Existing User**
- User already has `role: "vendor"` in profile
- Auth metadata also has `role: "vendor"`
- ✅ No change needed, system skips update

## Testing

### Test Cases:
1. ✅ User with `role: "user"` in profile, `role: "vendor"` in auth → Should upgrade
2. ✅ User with `role: "vendor"` in profile, `role: "owner"` in auth → Should upgrade
3. ✅ User with `role: "owner"` in profile, `role: "vendor"` in auth → Should NOT downgrade
4. ✅ User with matching roles → Should skip update

## Security Features

1. **Only Upgrades**: Never downgrades roles to prevent privilege escalation
2. **Explicit Check**: Only syncs if auth metadata explicitly has a role set
3. **Role Hierarchy**: Respects proper role hierarchy
4. **Database Constraint**: Database enforces valid role values

## Benefits

1. ✅ **Automatic Sync**: No manual database updates needed
2. ✅ **Works for All Users**: Applies to user, vendor, owner, admin
3. ✅ **Works for All Auth Methods**: Email/password, OAuth, etc.
4. ✅ **One-Time Migration**: Fixes existing users automatically
5. ✅ **Secure**: Never downgrades roles

## Notes

- The migration is **idempotent** - safe to run multiple times
- The sync happens on **every login** to keep roles in sync
- Role changes in auth metadata will be reflected on next login
- Profile role is the **source of truth** for authorization checks

