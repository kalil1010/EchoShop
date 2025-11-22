# EchoShop Database Security & Performance Deployment - Execution Order

Complete list of SQL files to run at Supabase in the correct order.

## Pre-Deployment: Run Verification Queries First

### 1. Pre-Deployment Verification
**File**: `20250201_pre_deployment_verification.sql`
**Purpose**: Audit current database state before making changes
**Action**: Run all queries and save outputs to CSV files:
- Query 1: Check if `security_dashboard_stats` view exists
- Query 2: Audit all functions → Save to `pre_deployment_function_audit.csv`
- Query 3: Identify all RLS policies → Save to `pre_deployment_rls_policies.csv`
- Query 4: Export current RLS policies → Save to `rollback_rls_policies.sql`
- Query 5-7: Additional verification queries

**Note**: Review outputs and ensure you have backups before proceeding.

---

## Phase 2: Security Fixes

### 2. Fix Security Dashboard Stats View (Conditional)
**File**: `20250201_fix_security_view.sql`
**Purpose**: Set `security_invoker = true` on the security dashboard stats view
**Note**: Only applies if the view exists (handled automatically by the script)
**Risk**: Low - View may not exist, which is fine

### 3. Fix Function Security Settings
**File**: `20250201_fix_function_security.sql`
**Purpose**: Add `SECURITY DEFINER` and `SET search_path = public` to all functions
**Risk**: Low - Function signatures remain identical
**Note**: Verify function signatures match your database. Adjust as needed based on Query 2 results from Step 1.

---

## Phase 3: Performance Optimization

### 4. Create STABLE Auth Functions
**File**: `20250201_create_stable_auth_functions.sql`
**Purpose**: Create three STABLE wrapper functions for auth context caching:
- `_get_current_user_id()`
- `_get_current_user_role()`
- `_get_current_vendor_id()`
**Risk**: Low - New functions only, no changes to existing code
**Dependency**: Must run before Phase 4 (RLS updates)

---

## Phase 4: RLS Policy Updates

### Priority 1: Core User Tables (Test after each)

#### 5. Profiles Table
**File**: `20250201_update_rls_profiles.sql`
**Tables**: `profiles`
**Risk**: Medium - Core user table, test login/logout after

#### 6. Vendor Products Table
**File**: `20250201_update_rls_vendor_products.sql`
**Tables**: `vendor_products`
**Risk**: Medium - Test vendor product access after

#### 7. Vendor Requests Table
**File**: `20250201_update_rls_vendor_requests.sql`
**Tables**: `vendor_requests`
**Risk**: Medium - Test vendor onboarding flow after

### Priority 2: Social Platform Tables (Test after batch)

#### 8. Posts Table
**File**: `20250201_update_rls_posts.sql`
**Tables**: `posts`
**Risk**: Medium - Test user feed after

#### 9. Comments Table
**File**: `20250201_update_rls_comments.sql`
**Tables**: `comments`
**Risk**: Medium - Test commenting functionality after

#### 10. Likes Table
**File**: `20250201_update_rls_likes.sql`
**Tables**: `likes`
**Risk**: Low - Test like/unlike functionality after

#### 11. Follows Table
**File**: `20250201_update_rls_follows.sql`
**Tables**: `follows`
**Risk**: Low - Test follow/unfollow functionality after

#### 12. Collections Table
**File**: `20250201_update_rls_collections.sql`
**Tables**: `collections`
**Risk**: Medium - Test collection features after

#### 13. Saves Table
**File**: `20250201_update_rls_saves.sql`
**Tables**: `saves`
**Risk**: Low - Test save/unsave functionality after

#### 14. Messages Table (Social Platform)
**File**: `20250201_update_rls_messages.sql`
**Tables**: `messages`
**Risk**: Medium - Test messaging functionality after

### Priority 3: Vendor & Admin Tables (Test after batch)

#### 15. Vendor Notifications Table
**File**: `20250201_update_rls_vendor_notifications.sql`
**Tables**: `vendor_notifications`
**Risk**: Medium - Test notification display after

#### 16. Vendor Owner Messages Table
**File**: `20250201_update_rls_vendor_owner_messages.sql`
**Tables**: `vendor_owner_messages`
**Risk**: Medium - Test vendor-owner messaging after

#### 17. Vendor Health Scores Table
**File**: `20250201_update_rls_vendor_health_scores.sql`
**Tables**: `vendor_health_scores`
**Risk**: Low - Admin/vendor dashboard feature

#### 18. Admin Audit Log Table
**File**: `20250201_update_rls_admin_audit_log.sql`
**Tables**: `admin_audit_log`
**Risk**: Low - Admin-only feature

#### 19. Orders and Order Items Tables
**File**: `20250201_update_rls_orders.sql`
**Tables**: `orders`, `order_items`
**Risk**: High - Critical e-commerce functionality, test thoroughly
**Note**: Test both customer and vendor order views after

#### 20. Vendor Assistants Tables
**File**: `20250201_update_rls_vendor_assistants.sql`
**Tables**: `vendor_assistants`, `vendor_assistant_invitations`
**Risk**: Medium - Test vendor assistant features after

#### 21. Feature Flags Tables
**File**: `20250201_update_rls_feature_flags.sql`
**Tables**: `feature_flags`, `feature_flag_assignments`
**Risk**: Low - Admin feature flag management

#### 22. Disputes Table
**File**: `20250201_update_rls_disputes.sql`
**Tables**: `disputes`
**Risk**: Medium - Test dispute resolution flows after

---

## Phase 5: Final Verification

### 23. Deployment Verification
**File**: `20250201_deployment_verification.sql`
**Purpose**: Verify all fixes applied correctly
**Action**: Run all verification queries and confirm:
- ✅ All functions have SECURITY DEFINER
- ✅ STABLE functions exist and are marked correctly
- ✅ All RLS policies updated (no legacy auth.uid() calls)
- ✅ View security fixed (if view exists)

---

## Complete Execution Checklist

### Pre-Deployment
- [ ] **Step 1**: Run `20250201_pre_deployment_verification.sql`
- [ ] Save Query 2 output to `pre_deployment_function_audit.csv`
- [ ] Save Query 3 output to `pre_deployment_rls_policies.csv`
- [ ] Save Query 4 output to `rollback_rls_policies.sql`
- [ ] Verify backup exists
- [ ] Review all outputs

### Phase 2: Security Fixes
- [ ] **Step 2**: Run `20250201_fix_security_view.sql`
- [ ] **Step 3**: Run `20250201_fix_function_security.sql`
- [ ] Verify all functions have SECURITY DEFINER set

### Phase 3: Performance Optimization
- [ ] **Step 4**: Run `20250201_create_stable_auth_functions.sql`
- [ ] Verify three STABLE functions created

### Phase 4: RLS Policy Updates - Priority 1
- [ ] **Step 5**: Run `20250201_update_rls_profiles.sql` → Test login/logout
- [ ] **Step 6**: Run `20250201_update_rls_vendor_products.sql` → Test product access
- [ ] **Step 7**: Run `20250201_update_rls_vendor_requests.sql` → Test onboarding

### Phase 4: RLS Policy Updates - Priority 2
- [ ] **Step 8**: Run `20250201_update_rls_posts.sql`
- [ ] **Step 9**: Run `20250201_update_rls_comments.sql`
- [ ] **Step 10**: Run `20250201_update_rls_likes.sql`
- [ ] **Step 11**: Run `20250201_update_rls_follows.sql`
- [ ] **Step 12**: Run `20250201_update_rls_collections.sql`
- [ ] **Step 13**: Run `20250201_update_rls_saves.sql`
- [ ] **Step 14**: Run `20250201_update_rls_messages.sql`
- [ ] Test all social platform features

### Phase 4: RLS Policy Updates - Priority 3
- [ ] **Step 15**: Run `20250201_update_rls_vendor_notifications.sql`
- [ ] **Step 16**: Run `20250201_update_rls_vendor_owner_messages.sql`
- [ ] **Step 17**: Run `20250201_update_rls_vendor_health_scores.sql`
- [ ] **Step 18**: Run `20250201_update_rls_admin_audit_log.sql`
- [ ] **Step 19**: Run `20250201_update_rls_orders.sql` → Test orders thoroughly
- [ ] **Step 20**: Run `20250201_update_rls_vendor_assistants.sql`
- [ ] **Step 21**: Run `20250201_update_rls_feature_flags.sql`
- [ ] **Step 22**: Run `20250201_update_rls_disputes.sql`
- [ ] Test all vendor and admin features

### Phase 5: Verification
- [ ] **Step 23**: Run `20250201_deployment_verification.sql`
- [ ] Review all verification results
- [ ] Confirm all checks pass

---

## Quick Reference: All Files in Order

```
1.  20250201_pre_deployment_verification.sql
2.  20250201_fix_security_view.sql
3.  20250201_fix_function_security.sql
4.  20250201_create_stable_auth_functions.sql
5.  20250201_update_rls_profiles.sql
6.  20250201_update_rls_vendor_products.sql
7.  20250201_update_rls_vendor_requests.sql
8.  20250201_update_rls_posts.sql
9.  20250201_update_rls_comments.sql
10. 20250201_update_rls_likes.sql
11. 20250201_update_rls_follows.sql
12. 20250201_update_rls_collections.sql
13. 20250201_update_rls_saves.sql
14. 20250201_update_rls_messages.sql
15. 20250201_update_rls_vendor_notifications.sql
16. 20250201_update_rls_vendor_owner_messages.sql
17. 20250201_update_rls_vendor_health_scores.sql
18. 20250201_update_rls_admin_audit_log.sql
19. 20250201_update_rls_orders.sql
20. 20250201_update_rls_vendor_assistants.sql
21. 20250201_update_rls_feature_flags.sql
22. 20250201_update_rls_disputes.sql
23. 20250201_deployment_verification.sql
```

---

## Important Notes

1. **Function Signatures**: Before running Step 3 (`fix_function_security.sql`), review the function signatures in your database and adjust the ALTER FUNCTION statements if needed. Use the audit from Step 1.

2. **Additional Tables**: The pre-deployment verification Query 3 will identify all RLS policies that need updating. You may need to create additional migration files for tables not covered in this list (e.g., `reports`, `communities`, `challenges`, etc.).

3. **Testing**: Test after each priority group. Don't proceed to the next group until the current group is verified working.

4. **Rollback**: Keep `rollback_rls_policies.sql` safe. If issues arise, you can revert RLS policies using that file.

5. **Estimated Time**: 45-60 minutes total (including testing)

---

## Risk Levels

- **Low Risk**: New functions, admin-only features, read-only optimizations
- **Medium Risk**: Core user features, vendor features
- **High Risk**: Orders/payments, authentication flows

Focus extra testing attention on high-risk items.

