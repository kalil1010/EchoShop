# Priority 3 Batch - Ready to Execute

## Batch Overview: Vendor & Admin Tables (8 files)

**Status**: ✅ Ready to run  
**Estimated Time**: ~20 minutes + testing  
**Risk Level**: Medium-High (includes critical e-commerce functionality)

---

## Files in This Batch

### 1. Vendor Notifications (File #16)
**File**: `20250201_update_rls_vendor_notifications.sql`
- **Policies**: 3 policies
- **Complexity**: Low
- **Key Features**: View own notifications, update (mark as read), service role inserts

### 2. Vendor Owner Messages (File #17)
**File**: `20250201_update_rls_vendor_owner_messages.sql`
- **Policies**: 3 policies
- **Complexity**: Medium (checks both sender_id and recipient_id)
- **Key Features**: Vendor-owner messaging, dual user checks

### 3. Vendor Health Scores (File #18)
**File**: `20250201_update_rls_vendor_health_scores.sql`
- **Policies**: 3 policies
- **Complexity**: Low-Medium (admin EXISTS subquery)
- **Key Features**: Vendors view own scores, admins view all, service role management

### 4. Admin Audit Log (File #19)
**File**: `20250201_update_rls_admin_audit_log.sql`
- **Policies**: 2 policies
- **Complexity**: Low-Medium (admin EXISTS subquery)
- **Key Features**: Admins view all logs, service role inserts only

### 5. Orders & Order Items ⚠️ **CRITICAL** (File #20)
**File**: `20250201_update_rls_orders.sql`
- **Policies**: 9 policies (orders + order_items tables)
- **Complexity**: High (multiple user roles, nested EXISTS subqueries)
- **Key Features**: 
  - Customer order views/updates
  - Vendor order views/updates
  - Admin full access (nested EXISTS)
  - Order items access control
- **⚠️ CRITICAL**: Test thoroughly - this is e-commerce core functionality

### 6. Vendor Assistants (File #21)
**File**: `20250201_update_rls_vendor_assistants.sql`
- **Policies**: 7 policies (assistants + invitations tables)
- **Complexity**: Medium (dual user checks, nested subqueries)
- **Key Features**: Vendor assistant management, invitation system

### 7. Feature Flags (File #22)
**File**: `20250201_update_rls_feature_flags.sql`
- **Policies**: 5 policies (flags + assignments tables)
- **Complexity**: Low-Medium (admin EXISTS subquery)
- **Key Features**: Admin flag management, vendor assignments

### 8. Disputes (File #23)
**File**: `20250201_update_rls_disputes.sql`
- **Policies**: 4 policies
- **Complexity**: Low-Medium (admin EXISTS subquery, customer/vendor checks)
- **Key Features**: Dispute resolution, role-based access

---

## Execution Order

Run files in sequence (16 → 23):

1. Vendor Notifications
2. Vendor Owner Messages
3. Vendor Health Scores
4. Admin Audit Log
5. **Orders** ⚠️ (CRITICAL - test thoroughly)
6. Vendor Assistants
7. Feature Flags
8. Disputes

---

## Testing Checklist (After All 8 Files)

### Vendor Notifications
- [ ] Vendor can view their notifications
- [ ] Vendor can mark notifications as read
- [ ] Notifications display correctly

### Vendor Owner Messages
- [ ] Vendor can send messages to owner/admin
- [ ] Vendor can view sent messages
- [ ] Vendor can view received messages
- [ ] Owner/admin can view messages

### Vendor Health Scores
- [ ] Vendor can view their own health score
- [ ] Admin can view all health scores
- [ ] Health scores update correctly

### Admin Audit Log
- [ ] Admin can view audit logs
- [ ] Audit logs are created correctly
- [ ] Non-admins cannot view logs

### Orders ⚠️ **CRITICAL TESTING**
- [ ] Customer can view their orders
- [ ] Customer can create orders
- [ ] Customer can update their orders (limited fields)
- [ ] Vendor can view orders for their products
- [ ] Vendor can update order status
- [ ] Admin can view all orders
- [ ] Admin can update all orders
- [ ] Order items access works correctly
- [ ] Customer can view their order items
- [ ] Vendor can view their order items
- [ ] Admin can view all order items

### Vendor Assistants
- [ ] Vendor can view their assistants
- [ ] Vendor can create assistant invitations
- [ ] Assistants can view their assignments
- [ ] Invitation system works

### Feature Flags
- [ ] Admin can view all feature flags
- [ ] Vendor can view their feature flag assignments
- [ ] Feature flags work correctly

### Disputes
- [ ] Customer can view their disputes
- [ ] Vendor can view their disputes
- [ ] Admin can view all disputes
- [ ] Dispute creation works

---

## Expected Results

After executing all 8 files:
- ✅ All vendor/admin RLS policies optimized
- ✅ E-commerce functionality secured (orders)
- ✅ Admin access controls working
- ✅ All auth.uid() calls replaced with cached functions
- ✅ Performance improvement on vendor/admin queries

---

## Quick Execution Guide

For each file:
1. Open Raw GitHub URL (see below)
2. Copy all SQL content
3. Go to Supabase Dashboard → SQL Editor
4. Paste SQL
5. Click "Run"
6. Confirm if prompted
7. Review verification query results

**Tip**: Run all 8 files in sequence, then test once after the batch. **Pay extra attention to orders testing!**

---

## GitHub Raw URLs for Priority 3

### 16. Vendor Notifications
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_vendor_notifications.sql
```

### 17. Vendor Owner Messages
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_vendor_owner_messages.sql
```

### 18. Vendor Health Scores
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_vendor_health_scores.sql
```

### 19. Admin Audit Log
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_admin_audit_log.sql
```

### 20. Orders ⚠️ CRITICAL
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_orders.sql
```

### 21. Vendor Assistants
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_vendor_assistants.sql
```

### 22. Feature Flags
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_feature_flags.sql
```

### 23. Disputes
```
https://raw.githubusercontent.com/kalil1010/EchoShop/main/docs/supabase/20250201_update_rls_disputes.sql
```

---

## Notes

- **Orders table** (#20) is the most critical - test customer, vendor, and admin access thoroughly
- **Vendor Assistants** (#21) has nested subqueries - similar complexity to posts table
- **Admin policies** use EXISTS subqueries - all updated to use cached functions
- All files include verification queries at the end
- Use Raw GitHub URLs to avoid markdown issues

---

## After This Batch

**Progress will be**: 22/24 files (92% complete)  
**Next**: Final verification (1 file)  
**Estimated Time Remaining**: ~5 minutes

---

## Success Criteria

After Priority 3 completion:
- ✅ All vendor features working
- ✅ All admin features working
- ✅ E-commerce (orders) fully functional
- ✅ All RLS policies optimized
- ✅ Ready for final verification

Let's complete the deployment! 🚀

