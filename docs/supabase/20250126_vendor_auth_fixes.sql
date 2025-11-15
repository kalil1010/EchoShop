-- ------------------------------------------------------------------
-- Vendor Authentication Flow Fixes - Schema Updates
-- ------------------------------------------------------------------
-- This migration ensures the database schema supports the vendor
-- authentication fixes implemented in AuthContext.tsx
--
-- Changes:
-- 1. Updates role constraint to include 'owner' role
-- 2. Adds composite index on vendor_requests for faster status queries
-- 3. Verifies RLS policies are correctly configured
-- ------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- 1. Update role constraint to include 'owner' role
-- ------------------------------------------------------------------
-- The application uses 'owner' as a distinct role, but the constraint
-- only allowed 'user', 'vendor', 'admin'. This update ensures
-- 'owner' is also allowed in the database.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'vendor', 'admin', 'owner'));

-- ------------------------------------------------------------------
-- 2. Add composite index for vendor_requests queries
-- ------------------------------------------------------------------
-- The checkVendorStatus() function queries vendor_requests with:
--   WHERE user_id = ? AND status = 'approved'
--   ORDER BY created_at DESC
--   LIMIT 1
--
-- A composite index on (user_id, status, created_at DESC) will
-- optimize this query pattern.

drop index if exists vendor_requests_user_id_status_created_idx;
create index if not exists vendor_requests_user_id_status_created_idx
  on public.vendor_requests (user_id, status, created_at desc);

-- ------------------------------------------------------------------
-- 3. Verify and ensure RLS policies are correct
-- ------------------------------------------------------------------
-- The RLS policy "Vendor requests select by owner" should allow
-- users to read their own vendor requests. This is critical for
-- checkVendorStatus() to work correctly.

-- Ensure RLS is enabled
alter table public.vendor_requests enable row level security;

-- Verify the select policy exists and is correct
-- (This will recreate it if it doesn't exist or is incorrect)
drop policy if exists "Vendor requests select by owner" on public.vendor_requests;
create policy "Vendor requests select by owner"
  on public.vendor_requests
  for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- 4. Add index on profiles.role for faster role lookups
-- ------------------------------------------------------------------
-- This index already exists in 20251022_dashboard_role_updates.sql,
-- but we'll ensure it exists here as well for completeness.

create index if not exists idx_profiles_role on public.profiles (role);

-- ------------------------------------------------------------------
-- Verification Queries (run these to verify the migration)
-- ------------------------------------------------------------------

-- Verify role constraint includes 'owner':
-- SELECT 
--   conname AS constraint_name,
--   pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.profiles'::regclass
--   AND conname = 'profiles_role_check';
-- Expected: role IN ('user', 'vendor', 'admin', 'owner')

-- Verify composite index exists:
-- SELECT 
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE tablename = 'vendor_requests'
--   AND indexname = 'vendor_requests_user_id_status_created_idx';
-- Expected: Index on (user_id, status, created_at DESC)

-- Verify RLS policy exists:
-- SELECT 
--   policyname,
--   cmd,
--   qual
-- FROM pg_policies
-- WHERE tablename = 'vendor_requests'
--   AND policyname = 'Vendor requests select by owner';
-- Expected: SELECT policy with qual: (auth.uid() = user_id)

