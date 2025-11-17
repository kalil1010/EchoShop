-- ========================================================================
-- Profile Performance Optimization
-- Date: 2025-01-17
-- Purpose: Optimize profile queries to reduce timeout issues
-- ========================================================================

-- 1. Ensure critical indexes exist for fast profile lookups
-- ========================================================================

-- Primary key index (should already exist, but ensure it's there)
-- This is the most critical index for user profile lookups
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey 
  ON public.profiles (id);

-- Role-based index for filtering by user role
CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON public.profiles (role);

-- Super admin index for quick admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin 
  ON public.profiles (id) 
  WHERE is_super_admin = true;

-- Email index for search and lookup operations
CREATE INDEX IF NOT EXISTS idx_profiles_email 
  ON public.profiles (email);

-- Vendor business name index for vendor searches
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_business_name 
  ON public.profiles (vendor_business_name) 
  WHERE vendor_business_name IS NOT NULL;

-- Created timestamp index for sorting and analytics
CREATE INDEX IF NOT EXISTS idx_profiles_created_at 
  ON public.profiles (created_at DESC);


-- 2. Analyze RLS policies and potentially optimize
-- ========================================================================

-- The existing RLS policies are:
-- 1. "Users can view their own profile" - using (auth.uid() = id)
-- 2. "Users can insert their own profile" - with check (auth.uid() = id)
-- 3. "Users can update their own profile" - using (auth.uid() = id)
-- 4. "Public profiles are viewable by everyone" - using (true)

-- These are already optimal. The key insight is that:
-- - Policy 1 & 3 use direct equality on indexed PK (id), which is fast
-- - Policy 4 allows public reads without any filtering, also fast
-- - No complex joins or subqueries that could slow down queries

-- If you experience RLS performance issues, consider:
-- 1. Creating a materialized view for frequently accessed profile data
-- 2. Using service role bypassing RLS for admin operations (already done)
-- 3. Caching profile data client-side (already implemented via sessionStorage)


-- 3. Add query timeout setting hint for connections
-- ========================================================================

-- Set a statement timeout at the database level to prevent hung queries
-- This is a safety net - queries taking longer than this will be cancelled
-- Note: This setting applies to the entire database
ALTER DATABASE postgres SET statement_timeout = '30s';

-- For the current session (if running interactively)
SET statement_timeout = '30s';


-- 4. Vacuum and analyze profiles table
-- ========================================================================

-- Update statistics for query planner optimization
-- This helps PostgreSQL choose the best query execution plan
ANALYZE public.profiles;

-- Optional: Run VACUUM to reclaim space and update statistics
-- Uncomment if your profiles table is large or has many updates
-- VACUUM ANALYZE public.profiles;


-- 5. Add helpful comments
-- ========================================================================

COMMENT ON TABLE public.profiles IS 
  'User profiles with role-based access. Indexed on id (PK), role, email, and created_at for performance.';

COMMENT ON INDEX profiles_pkey IS 
  'Primary key index - critical for fast user profile lookups by ID';

COMMENT ON INDEX idx_profiles_role IS 
  'Role-based filtering for admin dashboards and role checks';

COMMENT ON INDEX idx_profiles_email IS 
  'Email lookup and search operations';


-- 6. Connection pooling recommendations (for reference)
-- ========================================================================

-- Supabase uses PgBouncer for connection pooling by default
-- Recommended settings (these are typically configured by Supabase):
-- - pool_mode = transaction
-- - max_client_conn = 100 (or higher based on your plan)
-- - default_pool_size = 20

-- If using a custom database, ensure PgBouncer or similar is configured
-- to handle connection pooling efficiently.


-- 7. Performance monitoring queries (for debugging)
-- ========================================================================

-- Run these queries to check for performance issues:

-- Check slow queries (run as superuser or with appropriate permissions)
-- SELECT query, calls, total_time, mean_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%profiles%'
-- ORDER BY mean_time DESC
-- LIMIT 10;

-- Check table size and bloat
-- SELECT
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename = 'profiles';

-- Check index usage
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan as index_scans,
--   idx_tup_read as tuples_read,
--   idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'profiles'
-- ORDER BY idx_scan DESC;


-- 8. Supabase-specific optimizations
-- ========================================================================

-- Enable realtime for profiles if needed (optional)
-- This allows clients to subscribe to profile changes
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Ensure Row Level Security is enabled
-- (should already be enabled, but verify)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ========================================================================
-- Post-Migration Verification
-- ========================================================================

-- Verify indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
ORDER BY indexname;

-- Verify RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'profiles';

-- Check for any missing indexes or constraints
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass;

