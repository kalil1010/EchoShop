-- ------------------------------------------------------------------
-- Update RLS policies for orders and order_items tables
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid()
-- that also need updating.
--
-- IMPORTANT: This file assumes customer_id column exists in orders table.
-- If you get "column customer_id does not exist" error, run the diagnostic
-- query first: 20250201_diagnose_orders_schema.sql
-- ------------------------------------------------------------------

-- Step 1: Verify orders table exists and check column names
-- ------------------------------------------------------------------
-- Run this diagnostic query first if you're getting column errors:
/*
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orders'
AND (column_name LIKE '%customer%' OR column_name LIKE '%user%' OR column_name LIKE '%buyer%')
ORDER BY column_name;
*/

-- Ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- Orders Table Policies
-- ------------------------------------------------------------------

-- Policy: Customers can view their own orders
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders"
  ON public.orders
  FOR SELECT
  USING (public._get_current_user_id() = customer_id);

-- Policy: Vendors can view their orders
DROP POLICY IF EXISTS "Vendors can view their orders" ON public.orders;
CREATE POLICY "Vendors can view their orders"
  ON public.orders
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Customers can create orders
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = customer_id);

-- Policy: Vendors can update their orders
DROP POLICY IF EXISTS "Vendors can update their orders" ON public.orders;
CREATE POLICY "Vendors can update their orders"
  ON public.orders
  FOR UPDATE
  USING (public._get_current_user_id() = vendor_id)
  WITH CHECK (public._get_current_user_id() = vendor_id);

-- Policy: Customers can update their own orders
DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;
CREATE POLICY "Customers can update their own orders"
  ON public.orders
  FOR UPDATE
  USING (public._get_current_user_id() = customer_id)
  WITH CHECK (
    public._get_current_user_id() = customer_id
    AND (old.status = new.status OR new.status = 'cancelled')
  );

-- Policy: Admins can view all orders
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders"
  ON public.orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Policy: Admins can update all orders
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders"
  ON public.orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------------
-- Order Items Table Policies
-- ------------------------------------------------------------------

-- Policy: Customers can view their order items
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Customers can view their order items" ON public.order_items;
CREATE POLICY "Customers can view their order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.customer_id = public._get_current_user_id()
    )
  );

-- Policy: Vendors can view their order items
DROP POLICY IF EXISTS "Vendors can view their order items" ON public.order_items;
CREATE POLICY "Vendors can view their order items"
  ON public.order_items
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Admins can view all order items
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = public._get_current_user_id()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Note: Service role insert policy for order_items (if exists) uses 'true' check
-- which doesn't need updating - it remains as-is

-- Verification Queries
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

-- If you get "column customer_id does not exist" error:
-- ------------------------------------------------------------------
-- Step 1: Run the diagnostic query: 20250201_diagnose_orders_schema.sql
-- Step 2: Check what column name is actually used (might be user_id, buyer_id, etc.)
-- Step 3: Contact me with the column name and I'll create a corrected version

