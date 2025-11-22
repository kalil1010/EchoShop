# Orders Table Schema Mismatch - Resolution Guide

## Issue
**Error**: `column 'customer_id' does not exist` when running `20250201_update_rls_orders.sql`

## Root Cause
The RLS update file references `customer_id`, but your production database may:
1. Have a different column name (e.g., `user_id`, `buyer_id`)
2. Have the orders table structured differently
3. Not have the orders table created yet

## Solution Steps

### Step 1: Run Diagnostic Query
**File**: `20250201_diagnose_orders_schema.sql`

Run this query FIRST to see what columns actually exist in your orders table:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'orders'
ORDER BY ordinal_position;
```

### Step 2: Identify User-Related Columns
Check what user/customer column exists:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'orders'
AND (
    column_name LIKE '%customer%' OR
    column_name LIKE '%user%' OR
    column_name LIKE '%buyer%'
)
ORDER BY column_name;
```

### Step 3: Based on Results

#### Option A: `customer_id` exists
If the diagnostic shows `customer_id` exists:
- The issue might be a table alias or schema prefix issue
- Try running the standard file: `20250201_update_rls_orders.sql`
- Or use: `20250201_update_rls_orders_FIXED.sql` (includes better error handling)

#### Option B: Different column name found
If you see a different column (e.g., `user_id`, `buyer_id`):
1. Note the exact column name
2. I'll create a custom version of the orders RLS file with the correct column name
3. Replace all instances of `customer_id` with your actual column name

#### Option C: Orders table doesn't exist
If the table doesn't exist:
1. The orders table may not have been migrated yet
2. Check if you need to run `20250128_orders_schema.sql` first
3. Or the table might have a different name

### Step 4: Alternative - Check Existing Policies
If orders table exists but has different structure, check existing policies:

```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'orders';
```

This shows what column names the existing policies use - match those in the update file.

---

## Quick Fix Commands

### If using `user_id` instead of `customer_id`:
Replace in the RLS file:
- `customer_id` → `user_id`
- `orders.customer_id` → `orders.user_id`

### If using `buyer_id` instead of `customer_id`:
Replace in the RLS file:
- `customer_id` → `buyer_id`
- `orders.customer_id` → `orders.buyer_id`

---

## Verification

After fixing and running the orders RLS file, verify:

```sql
-- Check policies were created
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('orders', 'order_items')
ORDER BY tablename;

-- Test query (should not error)
SELECT COUNT(*) FROM public.orders WHERE customer_id = public._get_current_user_id();
-- (Replace customer_id with your actual column name if different)
```

---

## Need Help?

If the diagnostic doesn't reveal the issue, share:
1. Output from the diagnostic queries
2. Any error messages you're seeing
3. Whether the orders table exists and what it's used for

Then I can create a custom RLS file specifically for your schema.

