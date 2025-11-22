# Version Compatibility Guide

This guide helps you identify PostgreSQL version compatibility issues before running the migration files.

## Quick Version Check

Run this query first to check your PostgreSQL version:

```sql
SELECT 
    version() as full_version,
    current_setting('server_version_num')::int as version_number,
    CASE 
        WHEN current_setting('server_version_num')::int >= 150000 
        THEN '✅ PostgreSQL 15+ - All features supported'
        WHEN current_setting('server_version_num')::int >= 140000 
        THEN '⚠️ PostgreSQL 14 - Most features supported, security_invoker NOT supported'
        WHEN current_setting('server_version_num')::int >= 130000 
        THEN '⚠️ PostgreSQL 13 - Basic features supported, security_invoker NOT supported'
        ELSE '❌ PostgreSQL < 13 - Please upgrade'
    END as compatibility_status;
```

## Feature Compatibility Matrix

| Feature | PostgreSQL 13 | PostgreSQL 14 | PostgreSQL 15+ | Supabase |
|---------|---------------|---------------|----------------|----------|
| **SECURITY DEFINER** functions | ✅ | ✅ | ✅ | ✅ |
| **SET search_path** on functions | ✅ | ✅ | ✅ | ✅ |
| **STABLE** functions | ✅ | ✅ | ✅ | ✅ |
| **RLS policies** | ✅ | ✅ | ✅ | ✅ |
| **security_invoker** on views | ❌ | ❌ | ✅ | ⚠️ Check version |
| **pg_stat_statements** columns | `total_time` | `total_exec_time` | `total_exec_time` | Varies |

## Migration File Compatibility

### ✅ Works on All Versions

These files work on PostgreSQL 13+:

1. **Pre-Deployment Verification** (mostly)
   - Query 7 may need adjustment for pg_stat_statements columns
   - Updated version includes compatibility checks

2. **Function Security Fixes**
   - `20250201_fix_function_security.sql` - Works on all versions

3. **STABLE Auth Functions**
   - `20250201_create_stable_auth_functions.sql` - Works on all versions

4. **All RLS Policy Updates**
   - All `20250201_update_rls_*.sql` files - Work on all versions

5. **Deployment Verification**
   - `20250201_deployment_verification.sql` - Works on all versions (with minor adjustments)

### ⚠️ Version-Specific Files

#### Security View Fix (PostgreSQL 15+ only)

**File**: `20250201_fix_security_view.sql`

**PostgreSQL 13/14**: 
- The script will detect the version and skip the fix automatically
- This is safe - the feature isn't critical for security
- The view will work fine without this setting

**PostgreSQL 15+**: 
- Full feature support
- `security_invoker` will be set correctly

**Action**: Run the file anyway - it will auto-detect and skip if needed.

## pg_stat_statements Column Differences

PostgreSQL 13 and 14 have different column names in `pg_stat_statements`:

| Column | PostgreSQL 13 | PostgreSQL 14+ |
|--------|---------------|----------------|
| Total execution time | `total_time` | `total_exec_time` |
| Mean execution time | `mean_time` | `mean_exec_time` |
| Stddev execution time | `stddev_time` | `stddev_exec_time` |

The pre-deployment verification file has been updated to handle both versions.

## Recommended Approach

### Step 1: Check Your Version

```sql
SELECT version();
```

### Step 2: Review Compatibility

Based on your version:

- **PostgreSQL 15+**: All files work as-is
- **PostgreSQL 14**: All files work, except security_invoker is skipped automatically
- **PostgreSQL 13**: All files work, except:
  - security_invoker is skipped automatically
  - Query 8 in pre-deployment uses different column names (handled in updated file)

### Step 3: Run Pre-Deployment Verification

The updated `20250201_pre_deployment_verification.sql` includes version detection and will:
- Detect your PostgreSQL version
- Check if pg_stat_statements is available
- Adapt queries based on version

### Step 4: Run Migration Files

Run files in order as specified in `20250201_EXECUTION_ORDER.md`. The files will:
- Auto-detect unsupported features
- Skip gracefully when features aren't available
- Continue deployment safely

## Supabase-Specific Notes

Supabase may be running a custom PostgreSQL build. Check your Supabase dashboard:

1. Go to **Project Settings** → **Database**
2. Look for **PostgreSQL Version**
3. Check for any custom extensions or features

If you're unsure about a specific feature:
1. Run the pre-deployment verification queries first
2. Check for any errors
3. Contact Supabase support if needed

## What to Do if You Get Errors

### Error: "column security_invoker does not exist"

**Cause**: PostgreSQL < 15

**Solution**: This is expected. The updated `fix_security_view.sql` will detect this and skip automatically. This is safe - the feature is optional.

### Error: "column total_exec_time does not exist" (in pg_stat_user_functions)

**Cause**: PostgreSQL 13 uses `total_time` instead

**Solution**: The updated pre-deployment verification includes both queries. Use Query 8b for PostgreSQL 13.

### Error: "extension pg_stat_statements does not exist"

**Cause**: Extension not installed

**Solution**: This is optional for baseline metrics. The deployment can proceed without it. To install:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Note: This may require superuser privileges.

## Fallback Strategy

If you encounter compatibility issues:

1. **Skip Phase 2.1** (security_invoker fix) if on PostgreSQL < 15
2. **Continue with all other phases** - they work on PostgreSQL 13+
3. **Focus on critical fixes**:
   - Phase 2.2: Function security (works on all versions)
   - Phase 3: STABLE functions (works on all versions)
   - Phase 4: RLS policies (works on all versions)

The most important performance improvements come from Phases 3 and 4, which work on all PostgreSQL versions.

## Testing Compatibility

Before running the full deployment, test with this simple query:

```sql
-- Test 1: Check version
SELECT version();

-- Test 2: Check if security_invoker is supported
SELECT 
    CASE 
        WHEN current_setting('server_version_num')::int >= 150000 
        THEN 'Supported'
        ELSE 'Not Supported'
    END as security_invoker_support;

-- Test 3: Check pg_stat_statements columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'pg_catalog' 
AND table_name = 'pg_stat_user_functions'
AND column_name LIKE '%time%'
ORDER BY column_name;
```

This will tell you exactly which features are available in your environment.

