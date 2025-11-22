# Remaining Function Fixes - Batch Execution Guide

## 📊 **CURRENT STATUS**

- **Total functions in public schema**: 77
- **Functions already fixed**: 21 ✅
- **Functions remaining to fix**: 56 ⚠️
- **Progress**: 27% complete (21 of 77)
- **Target**: Fix all 56 remaining functions

---

## 🎯 **STRATEGY: Simple Batch Execution**

To avoid Supabase SQL editor limitations, we'll use simple one-line ALTER statements in small batches.

---

## 📋 **STEP-BY-STEP PROCESS**

### Step 1: Generate All Remaining ALTER Statements (2 minutes)

1. **Open**: `20250201_GENERATE_REMAINING_FUNCTION_FIXES.sql`
2. **Run**: MAIN QUERY (first query in the file)
3. **Copy**: All values from the `fix_command` column
4. **Expected**: ~56 ALTER FUNCTION statements

**Note**: Each function overload will appear as a separate row. That's correct - each overload needs its own ALTER statement.

---

### Step 2: Organize Into Batches (5 minutes)

Split the 56 statements into batches of 10-15 functions:

- **Batch 1**: First 10-15 statements
- **Batch 2**: Next 10-15 statements
- **Batch 3**: Next 10-15 statements
- **Batch 4**: Remaining statements

**Why small batches?**
- Avoids Supabase editor timeouts
- Easier to track progress
- Allows verification after each batch

---

### Step 3: Execute Batch 1 (5 minutes)

```sql
BEGIN;

-- Paste first 10-15 ALTER statements here
-- Example:
ALTER FUNCTION public.mark_all_notifications_read(uuid) SET search_path = public;
ALTER FUNCTION public.notify_on_comment() SET search_path = public;
ALTER FUNCTION public.notify_on_follow() SET search_path = public;
-- ... (10-15 total)

COMMIT;
```

**After execution**:
1. Run verification query to check progress
2. Note any errors (if any functions fail)
3. Document successful fixes

---

### Step 4: Verify Progress (2 minutes)

Run this verification query after each batch:

```sql
SELECT 
    COUNT(*) FILTER (
        WHERE pg_get_functiondef(p.oid) LIKE '%SET search_path%'
        OR p.proname LIKE '_get_current_%'
    ) as functions_with_search_path,
    COUNT(*) FILTER (
        WHERE NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
        AND p.proname NOT LIKE '_get_current_%'
    ) as functions_missing_search_path,
    COUNT(*) as total_functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'pg_%';
```

**Expected Progress After Each Batch**:
- Batch 1: 21 → 31-36 functions fixed
- Batch 2: 31-36 → 41-51 functions fixed
- Batch 3: 41-51 → 51-66 functions fixed
- Batch 4: 51-66 → 77 functions fixed (100%)

---

### Step 5: Repeat for Remaining Batches

Execute batches 2, 3, and 4 using the same process:

1. Copy next batch of ALTER statements
2. Wrap in BEGIN/COMMIT transaction
3. Execute in Supabase SQL Editor
4. Run verification query
5. Document progress

---

## 🔍 **HANDLING FUNCTION OVERLOADS**

Some functions have multiple overloads (same name, different parameters):

**Example**: `can_apply_for_vendor` might have:
- `can_apply_for_vendor()`
- `can_apply_for_vendor(uuid)`

**Solution**: Each overload appears as a separate row in the generated query. Execute ALL of them - each overload needs its own ALTER statement.

**To Identify Overloads**:
Run the "IDENTIFY FUNCTION OVERLOADS" query in the generator file to see which functions have multiple variants.

---

## ⚠️ **TROUBLESHOOTING**

### Issue: ALTER statement fails with "function does not exist"

**Possible Causes**:
1. Function name or signature mismatch
2. Function was dropped
3. Parameter types don't match exactly

**Solution**:
1. Check the exact function signature:
   ```sql
   SELECT pg_get_function_identity_arguments(oid) 
   FROM pg_proc 
   WHERE proname = 'function_name';
   ```
2. Verify function exists:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'function_name';
   ```
3. Use the exact signature from the generated query

---

### Issue: Supabase editor times out

**Possible Causes**:
- Too many statements in one transaction
- Complex function definitions

**Solution**:
1. Reduce batch size (try 5-10 statements instead of 15)
2. Execute batches separately
3. Wait 30 seconds between batches

---

### Issue: Some functions still show as missing after ALTER

**Possible Causes**:
1. Function overloads not all fixed
2. Cache delay in pg_get_functiondef()

**Solution**:
1. Check for function overloads (run overloads query)
2. Wait 1 minute and re-run verification
3. Check if ALL overloads of the function were fixed

---

## 📊 **PROGRESS TRACKING**

### Current Progress

| Batch | Functions Fixed | Remaining | Status |
|-------|----------------|-----------|--------|
| Initial | 21 | 56 | ✅ Complete |
| Batch 1 | +10-15 | 41-46 | ⏳ Pending |
| Batch 2 | +10-15 | 26-36 | ⏳ Pending |
| Batch 3 | +10-15 | 11-26 | ⏳ Pending |
| Batch 4 | +11-26 | 0 | ⏳ Pending |
| **Total** | **77** | **0** | **🎯 Target** |

### Expected Functions to Fix (Sample)

Based on your note, remaining functions include:
- mark_all_notifications_read
- notify_on_comment
- notify_on_follow
- notify_on_like
- notify_product_moderation_change
- promote_user_to_vendor
- regenerate_backup_codes
- reset_2fa_attempts
- touch_challenges_updated_at
- ... (approximately 46 more)

---

## ✅ **SUCCESS CRITERIA**

### Completion Checklist

- [ ] All 56 remaining functions have ALTER statements generated
- [ ] Batches organized into 4 groups (10-15 functions each)
- [ ] Batch 1 executed and verified
- [ ] Batch 2 executed and verified
- [ ] Batch 3 executed and verified
- [ ] Batch 4 executed and verified
- [ ] Final verification shows 77 functions with search_path
- [ ] Supabase linter refreshed showing 0-10 warnings (down from 65)

---

## 🚀 **QUICK START**

1. **Open**: `20250201_GENERATE_REMAINING_FUNCTION_FIXES.sql`
2. **Run**: MAIN QUERY to get all 56 ALTER statements
3. **Copy**: All fix_command values
4. **Organize**: Split into 4 batches of 10-15 statements
5. **Execute**: One batch at a time with verification after each
6. **Verify**: Run verification query after each batch
7. **Complete**: Refresh Supabase linter when all 56 are fixed

**Estimated Time**: 30-45 minutes for all 4 batches

---

## 📝 **NOTES**

### Why This Approach Works

1. **Simple statements**: No complex DO blocks or WHERE conditions
2. **Small batches**: Avoids editor timeouts
3. **Direct ALTER**: PostgreSQL handles parameter matching correctly
4. **Easy verification**: Check progress after each batch

### Key Benefits

- ✅ Avoids Supabase editor limitations
- ✅ Easy to track progress
- ✅ Allows verification after each batch
- ✅ Handles function overloads correctly
- ✅ Safe transaction rollback if needed

---

**Ready to complete the remaining 56 function fixes!** 🎯

