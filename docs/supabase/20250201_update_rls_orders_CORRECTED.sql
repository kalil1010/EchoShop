-- ------------------------------------------------------------------
-- Update RLS policies for orders and order_items tables (CORRECTED)
-- ------------------------------------------------------------------
-- Phase 4.3: Priority 3 - Vendor & Admin Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization. Note: Admin policies use EXISTS subqueries with auth.uid()
-- that also need updating.
--
-- IMPORTANT: This version uses user_id instead of customer_id based on
-- actual database schema. The orders table uses:
-- - user_id (for customer references)
-- - vendor_id (for vendor references)
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- Orders Table Policies
-- ------------------------------------------------------------------

-- Policy: Customers can view their own orders
-- CORRECTED: Uses user_id instead of customer_id
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;
CREATE POLICY "Customers can view their own orders"
  ON public.orders
  FOR SELECT
  USING (public._get_current_user_id() = user_id);

-- Policy: Vendors can view their orders
DROP POLICY IF EXISTS "Vendors can view their orders" ON public.orders;
CREATE POLICY "Vendors can view their orders"
  ON public.orders
  FOR SELECT
  USING (public._get_current_user_id() = vendor_id);

-- Policy: Customers can create orders
-- CORRECTED: Uses user_id instead of customer_id
DROP POLICY IF EXISTS "Customers can create orders" ON public.orders;
CREATE POLICY "Customers can create orders"
  ON public.orders
  FOR INSERT
  WITH CHECK (public._get_current_user_id() = user_id);

-- Policy: Vendors can update their orders
DROP POLICY IF EXISTS "Vendors can update their orders" ON public.orders;
CREATE POLICY "Vendors can update their orders"
  ON public.orders
  FOR UPDATE
  USING (public._get_current_user_id() = vendor_id)
  WITH CHECK (public._get_current_user_id() = vendor_id);

-- Policy: Customers can update their own orders
-- CORRECTED: Uses user_id instead of customer_id
DROP POLICY IF EXISTS "Customers can update their own orders" ON public.orders;
CREATE POLICY "Customers can update their own orders"
  ON public.orders
  FOR UPDATE
  USING (public._get_current_user_id() = user_id)
  WITH CHECK (
    public._get_current_user_id() = user_id
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
-- CORRECTED: Uses user_id instead of customer_id in join
-- This policy has nested auth.uid() in EXISTS subquery
DROP POLICY IF EXISTS "Customers can view their order items" ON public.order_items;
CREATE POLICY "Customers can view their order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = public._get_current_user_id()
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

-- Expected: 10 policies total
-- Orders: 7 policies (customer view, vendor view, customer create, vendor update, customer update, admin view, admin update)
-- Order Items: 3 policies (customer view, vendor view, admin view)

