-- ------------------------------------------------------------------
-- Diagnostic Query: Check Orders Table Schema
-- ------------------------------------------------------------------
-- Run this query FIRST to identify what columns exist in your orders table
-- This will help us determine if there's a schema mismatch
-- ------------------------------------------------------------------

-- Query 1: Check if orders table exists and list all columns
-- ------------------------------------------------------------------
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'orders'
ORDER BY ordinal_position;

-- Query 2: Check if order_items table exists and list all columns
-- ------------------------------------------------------------------
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'order_items'
ORDER BY ordinal_position;

-- Query 3: Check what user-related columns exist in orders table
-- ------------------------------------------------------------------
SELECT 
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'orders'
AND (
    column_name LIKE '%customer%' OR
    column_name LIKE '%user%' OR
    column_name LIKE '%buyer%' OR
    column_name LIKE '%client%'
)
ORDER BY column_name;

-- Query 4: Check existing RLS policies on orders table (if any)
-- ------------------------------------------------------------------
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('orders', 'order_items')
ORDER BY tablename, policyname;

-- Expected Results:
-- ------------------------------------------------------------------
-- If customer_id exists: You should see 'customer_id' in Query 3 results
-- If customer_id does NOT exist: You might see 'user_id', 'buyer_id', or similar
-- 
-- Based on the results:
-- - If customer_id exists: Use the standard orders RLS file
-- - If customer_id does NOT exist: We need to create an alternative version

