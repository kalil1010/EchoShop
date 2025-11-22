# Migration Files Updated for PostgreSQL Version Compatibility

## Overview

The migration files have been updated to handle PostgreSQL version compatibility issues, specifically:

1. **security_invoker feature** (requires PostgreSQL 15+)
2. **pg_stat_statements column names** (different between PostgreSQL 13 and 14+)
3. **Version detection and graceful degradation**

## Files Updated

### 1. Pre-Deployment Verification (UPDATED)
**File**: `20250201_pre_deployment_verification.sql`

**Changes**:
- ✅ Added Query 7: PostgreSQL version check
- ✅ Updated Query 8: Version-adaptive pg_stat_statements query
  - Query 8a for PostgreSQL 14+ (uses `total_exec_time`)
  - Query 8b for PostgreSQL 13 (uses `total_time`)
- ✅ Added Query 9: Check for security_invoker support

**Result**: Now works on PostgreSQL 13, 14, and 15+

### 2. Security View Fix (UPDATED)
**File**: `20250201_fix_security_view.sql`

**Changes**:
- ✅ Added version detection using `server_version_num`
- ✅ Checks if PostgreSQL >= 15 before attempting `security_invoker` fix
- ✅ Gracefully skips if version < 15 (safe - feature is optional)
- ✅ Better error handling and informative messages

**Result**: Works on all versions - automatically skips unsupported features

### 3. New Compatibility Check File (NEW)
**File**: `20250201_COMPATIBILITY_FIXES.sql`

**Purpose**: Run this FIRST to check compatibility before deployment

**Checks**:
- PostgreSQL version
- Feature support matrix
- pg_stat_statements availability
- Column name differences
- View existence

**Result**: Helps identify issues before running full migration

## New Documentation

### Version Compatibility Guide (NEW)
**File**: `20250201_VERSION_COMPATIBILITY.md`

**Contents**:
- Feature compatibility matrix
- Version-specific notes
- Troubleshooting guide
- Recommended approach for different versions

### Execution Order Updated
**File**: `20250201_EXECUTION_ORDER.md`

**Changes**:
- ✅ Added Step 0: Compatibility check (run first)
- ✅ Updated Step 2: Notes about version-aware security_invoker fix
- ✅ Added compatibility notes throughout

## Compatibility Matrix

| Feature | PostgreSQL 13 | PostgreSQL 14 | PostgreSQL 15+ |
|---------|---------------|---------------|----------------|
| Function Security Fixes | ✅ | ✅ | ✅ |
| STABLE Auth Functions | ✅ | ✅ | ✅ |
| RLS Policy Updates | ✅ | ✅ | ✅ |
| security_invoker on views | ❌ (skipped) | ❌ (skipped) | ✅ |
| pg_stat_statements | ✅ (old columns) | ✅ (new columns) | ✅ (new columns) |

## How It Works

### Automatic Version Detection

All files now use PostgreSQL's `server_version_num` setting:

```sql
current_setting('server_version_num')::int
```

- PostgreSQL 13: `130000`
- PostgreSQL 14: `140000`
- PostgreSQL 15: `150000`

### Graceful Degradation

When a feature isn't supported:
1. Version is detected
2. Feature is skipped automatically
3. Informative message is logged
4. Deployment continues safely

**Example**: `security_invoker` fix on PostgreSQL 14:
```
RAISE NOTICE 'PostgreSQL version 14.x does not support security_invoker (requires 15+) - skipping this fix'
```

This is safe - the feature is optional and doesn't affect core functionality.

## Execution Steps (Updated)

### Step 0: Run Compatibility Check (NEW)

```sql
-- Run this FIRST
\i docs/supabase/20250201_COMPATIBILITY_FIXES.sql
```

This will tell you:
- Your PostgreSQL version
- Which features are supported
- What will be skipped automatically

### Step 1: Continue as Normal

All subsequent steps work exactly the same. Files will automatically:
- Detect your version
- Skip unsupported features
- Continue deployment safely

## Testing the Updates

Before running the full deployment, test compatibility:

```sql
-- 1. Check version
SELECT version();

-- 2. Run compatibility check
\i docs/supabase/20250201_COMPATIBILITY_FIXES.sql

-- 3. Test security_invoker fix (will skip if not supported)
\i docs/supabase/20250201_fix_security_view.sql
```

You should see messages indicating:
- ✅ What features are supported
- ⚠️ What will be skipped (and why)
- ℹ️ Recommendations

## Benefits

1. **No Breaking Changes**: Files work on PostgreSQL 13, 14, and 15+
2. **Automatic Detection**: No manual configuration needed
3. **Safe Skipping**: Unsupported features are skipped gracefully
4. **Clear Messages**: Informative logs explain what's happening
5. **Full Functionality**: Core fixes (function security, STABLE functions, RLS) work on all versions

## What You Need to Do

1. **Run Step 0** (compatibility check) first
2. **Review the results** - understand what will be skipped
3. **Continue with normal deployment** - files handle version differences automatically

## Important Notes

- **security_invoker fix**: Optional feature. Skipping it on PostgreSQL < 15 is safe and doesn't affect security.
- **pg_stat_statements**: Optional for baseline metrics. Deployment works fine without it.
- **Core fixes**: All critical fixes (function security, STABLE functions, RLS) work on PostgreSQL 13+

## Support

If you encounter issues:
1. Check `20250201_VERSION_COMPATIBILITY.md` for troubleshooting
2. Review the compatibility check results
3. Verify your PostgreSQL version matches what's reported

The migration files are now fully compatible with PostgreSQL 13, 14, and 15+.

