# Orders Table Schema Correction - Applied

## Issue Resolution

**Original Issue**: Column `customer_id` does not exist error

**Root Cause**: Production schema uses `user_id` instead of `customer_id`

**Resolution**: Created corrected RLS file using actual column names

---

## Schema Differences

### Expected Schema (from migration file)
```sql
customer_id uuid not null references auth.users(id)
```

### Actual Production Schema
```sql
user_id uuid not null references auth.users(id)
```

---

## Corrections Applied

All references to `customer_id` were changed to `user_id`:

1. **Customer view policy**: `user_id` instead of `customer_id`
2. **Customer create policy**: `user_id` instead of `customer_id`
3. **Customer update policy**: `user_id` instead of `customer_id`
4. **Order items join**: `orders.user_id` instead of `orders.customer_id`

---

## Corrected File

**File**: `20250201_update_rls_orders_CORRECTED.sql`

**Key Changes**:
- All `customer_id` → `user_id`
- All `orders.customer_id` → `orders.user_id`
- All other logic remains identical

**Policies Updated**: 10 policies (7 for orders table, 3 for order_items table)

---

## Verification

After correction, the following policies were successfully deployed:

### Orders Table (7 policies)
1. Customers can view their own orders (using `user_id`)
2. Vendors can view their orders (using `vendor_id`)
3. Customers can create orders (using `user_id`)
4. Vendors can update their orders (using `vendor_id`)
5. Customers can update their own orders (using `user_id`)
6. Admins can view all orders
7. Admins can update all orders

### Order Items Table (3 policies)
1. Customers can view their order items (join via `orders.user_id`)
2. Vendors can view their order items (using `vendor_id`)
3. Admins can view all order items

---

## Notes

- The `vendor_id` column was correct and didn't need changes
- All admin policies (with EXISTS subqueries) worked as expected
- The corrected file is ready for future use or reference
- This schema difference is now documented for future migrations

---

## Future Reference

If the orders table schema is updated to use `customer_id` in the future:
- Use the original `20250201_update_rls_orders.sql` file
- Or update this corrected version to match the new schema

For now, the corrected version (`20250201_update_rls_orders_CORRECTED.sql`) matches production and has been successfully deployed.

