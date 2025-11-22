-- ------------------------------------------------------------------
-- Update RLS policies for vendor_products table
-- ------------------------------------------------------------------
-- Phase 4.1: Priority 1 - Core User Tables
-- 
-- Replace auth.uid() with public._get_current_user_id() for performance
-- optimization.
-- ------------------------------------------------------------------

-- Ensure RLS is enabled
ALTER TABLE public.vendor_products ENABLE ROW LEVEL SECURITY;

-- Policy: Vendors manage their products
DROP POLICY IF EXISTS "Vendors manage their products" ON public.vendor_products;
CREATE POLICY "Vendors manage their products"
  ON public.vendor_products
  FOR ALL
  USING (public._get_current_user_id() = vendor_id)
  WITH CHECK (public._get_current_user_id() = vendor_id);

-- Policy: Public can view active products (no change - uses status check)
DROP POLICY IF EXISTS "Public can view active products" ON public.vendor_products;
CREATE POLICY "Public can view active products"
  ON public.vendor_products
  FOR SELECT
  USING (status = 'active');

-- Verification Query
-- ------------------------------------------------------------------
SELECT 
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'vendor_products'
ORDER BY policyname;

