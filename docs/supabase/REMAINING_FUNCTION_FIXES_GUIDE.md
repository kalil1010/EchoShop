# Remaining Function Search Path Fixes - Handling Guide

## Overview

After the initial bulk fix of 55 functions, there may be 0-10 remaining functions that still need `SET search_path = public`. This guide helps you identify and fix any remaining functions.

---

## Step 1: Identify Remaining Functions

### Run This Query

```sql
-- Find all functions still missing search_path
SELECT 
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' 
        THEN '✅ HAS search_path'
        ELSE '❌ MISSING search_path'
    END as status,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%')
ORDER BY p.proname;
```

This will show:
- ✅ Functions that are already fixed
- ❌ Functions that still need fixing

---

## Step 2: Categorize Remaining Functions

### Category A: Functions with DEFAULT Parameters (Special Handling)

**How to Identify**:
```sql
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%');
```

**Why Special**: ALTER FUNCTION requires the full signature including DEFAULT values.

**Fix Method**:
1. Check the function definition to see exact parameter signature
2. Use `pg_get_functiondef()` to see the full CREATE statement
3. Create ALTER statement matching exact signature

**Example**:
```sql
-- If function is defined as:
CREATE FUNCTION my_func(p_id uuid, p_name text DEFAULT 'test')
RETURNS void AS ...

-- The ALTER statement must be:
ALTER FUNCTION public.my_func(p_id uuid, p_name text DEFAULT 'test')
SET search_path = public;
```

**Note**: If functions with DEFAULT are system functions or rarely used, you may choose to accept them as-is.

---

### Category B: System/Internal Functions (Can Ignore)

**How to Identify**:
- Functions that are PostgreSQL extensions
- Functions created by Supabase automatically
- Functions with complex or unusual signatures

**Action**: **Accept as-is** - these are expected to not have explicit search_path.

---

### Category C: Standard Functions (Easy Fix)

**How to Identify**:
- User-created functions
- Functions without DEFAULT parameters
- Functions with standard signatures

**Fix Method**: Use the generator query from `20250201_FIX_ALL_FUNCTION_SEARCH_PATHS.sql`

**Example**:
```sql
-- Generate ALTER statement
SELECT 
    format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
        n.nspname,
        p.proname,
        COALESCE(pg_get_function_identity_arguments(p.oid), '')
    ) as fix_command
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname = 'your_function_name'  -- Replace with actual function name
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%');
```

---

## Step 3: Fix Remaining Functions

### For Standard Functions (Category C)

1. **Generate ALTER Statement**:
   ```sql
   SELECT 
       format(
           'ALTER FUNCTION %I.%I(%s) SET search_path = public;',
           n.nspname,
           p.proname,
           COALESCE(pg_get_function_identity_arguments(p.oid), '')
       ) as fix_command
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public'
   AND p.prokind = 'f'
   AND p.proname NOT LIKE 'pg_%'
   AND p.proname NOT LIKE '_get_current_%'
   AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%');
   ```

2. **Execute in Transaction**:
   ```sql
   BEGIN;
   
   -- Paste all generated ALTER statements here
   ALTER FUNCTION public.function1(...) SET search_path = public;
   ALTER FUNCTION public.function2(...) SET search_path = public;
   -- ... (all remaining)
   
   COMMIT;
   ```

### For Functions with DEFAULT Parameters (Category A)

1. **Get Full Function Definition**:
   ```sql
   SELECT pg_get_functiondef(oid) 
   FROM pg_proc 
   WHERE proname = 'your_function_name';
   ```

2. **Extract Exact Signature**:
   - Look at the CREATE FUNCTION statement
   - Copy the exact parameter list including DEFAULT values

3. **Create Manual ALTER Statement**:
   ```sql
   ALTER FUNCTION public.your_function_name(
       param1 type1,
       param2 type2 DEFAULT 'value'
   ) SET search_path = public;
   ```

4. **Execute Individually** (test first):
   ```sql
   -- Test with one function first
   ALTER FUNCTION public.your_function_name(...) SET search_path = public;
   
   -- If successful, continue with others
   ```

---

## Step 4: Verify Final Status

### Count Remaining Functions

```sql
SELECT 
    COUNT(*) as functions_still_missing_search_path,
    COUNT(*) FILTER (
        WHERE pg_get_function_identity_arguments(p.oid) LIKE '%DEFAULT%'
    ) as functions_with_default_params,
    COUNT(*) FILTER (
        WHERE pg_get_function_identity_arguments(p.oid) NOT LIKE '%DEFAULT%'
    ) as standard_functions_still_missing
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE '_get_current_%'
AND NOT (pg_get_functiondef(p.oid) LIKE '%SET search_path%');
```

### Expected Results

**Ideal**: 0 functions still missing search_path  
**Acceptable**: 0-5 functions (system/internal functions)  
**Review Needed**: 5+ functions (may indicate issue)

---

## Step 5: Document Special Cases

### If You Choose to Accept Some Functions As-Is

Document which functions are intentionally left without search_path:

```markdown
## Functions Without search_path (Accepted)

1. **function_name_1**
   - Reason: System function / PostgreSQL extension
   - Action: Accepted as-is

2. **function_name_2**
   - Reason: Has DEFAULT parameters / complex signature
   - Action: Manual fix deferred
```

---

## Decision Tree

```
Start: Remaining functions found
  │
  ├─> Has DEFAULT parameters?
  │   ├─> YES → Manual ALTER with full signature OR Accept as-is
  │   └─> NO → Continue
  │
  ├─> System/extension function?
  │   ├─> YES → Accept as-is (expected)
  │   └─> NO → Continue
  │
  ├─> User-created function?
  │   ├─> YES → Fix using generator query
  │   └─> NO → Accept as-is
  │
  └─> Review function definition
      ├─> Simple signature → Fix immediately
      └─> Complex signature → Manual review needed
```

---

## Summary

### Quick Actions

1. **Run identification query** to see remaining functions
2. **Categorize** functions (DEFAULT params, system, standard)
3. **Fix standard functions** using generator query
4. **Handle special cases** manually or accept as-is
5. **Verify final status** with count query

### Expected Outcome

- **Standard functions**: All fixed ✅
- **DEFAULT parameter functions**: Manual fix or accepted ⚠️
- **System functions**: Accepted as-is ✅

### Success Criteria

- ✅ **95%+ of user functions** have search_path
- ✅ **0 critical functions** missing search_path
- ✅ **System functions** accepted (expected)

---

**Ready to handle remaining functions!** 🔧

