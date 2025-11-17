# Timeout Configuration Guide

This document explains the timeout settings in the application and how to configure them for optimal performance.

## Overview

The application uses several timeouts to balance between user experience and reliability when loading user sessions and profiles from Supabase.

## Environment Variables

### `NEXT_PUBLIC_PROFILE_TIMEOUT`

Controls how long the app waits for the profile data to load from the database before falling back to a temporary profile.

- **Default**: `20000` (20 seconds)
- **Recommended Range**: `15000-30000` (15-30 seconds)
- **Type**: Number (milliseconds)

**Example:**
```env
NEXT_PUBLIC_PROFILE_TIMEOUT=20000
```

**When to adjust:**
- Increase if you see frequent "Profile loading is taking longer than expected" messages
- Decrease if you want faster fallback to temporary profiles (but risk more timeout errors)
- Consider network latency between your deployment and Supabase region

## Internal Timeouts

These are configured in the code and don't require environment variables:

### Session Timeout

- **Location**: `src/contexts/AuthContext.tsx` → `SESSION_TIMEOUT_MS`
- **Default**: `15000` (15 seconds)
- **Purpose**: Prevents indefinite hanging when Supabase's `getSession()` call stalls

### Profile Cache TTL

- **Location**: `src/contexts/AuthContext.tsx` → `SESSION_CACHE_TTL`
- **Default**: `300000` (5 minutes)
- **Purpose**: How long cached session data in sessionStorage remains valid

### Role Sync Timeout

- **Location**: `src/contexts/AuthContext.tsx` → `reconcileProfileAfterAuth` timeout
- **Default**: `5000` (5 seconds)
- **Purpose**: Prevents role synchronization from blocking session initialization

## Performance Optimization Tips

### 1. Database Performance

If you're experiencing frequent timeouts, check:

- **Supabase Dashboard → Database → Query Performance**
- **Row Level Security (RLS) policies** - Complex policies can slow queries
- **Database region** - Choose a region close to your deployment

### 2. Indexing

The following indexes should exist on the `profiles` table:

```sql
-- Primary key (automatic)
CREATE INDEX IF NOT EXISTS profiles_pkey ON public.profiles (id);

-- Role index (for role-based queries)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- Super admin index (for admin queries)
CREATE INDEX IF NOT EXISTS idx_profiles_super_admin 
  ON public.profiles (id) 
  WHERE is_super_admin = true;
```

### 3. Network Considerations

- **CDN/Edge**: Deploy your app close to your Supabase instance
- **Connection pooling**: Supabase uses connection pooling automatically
- **Cold starts**: First requests after idle periods may be slower

## Troubleshooting

### "Profile sync is delayed" Error

**Symptoms:**
- User sees "Profile loading is taking longer than expected"
- Console shows `[AuthContext] getSession() timed out`
- Multiple `[middleware] Stale cookies detected` messages

**Causes:**
1. Database timeout (query taking > 20 seconds)
2. Network latency between app and Supabase
3. Supabase region experiencing issues
4. Complex RLS policies slowing queries

**Solutions:**
1. **Increase timeout**: Set `NEXT_PUBLIC_PROFILE_TIMEOUT=30000`
2. **Check Supabase status**: https://status.supabase.com
3. **Optimize RLS policies**: Simplify or add indexes
4. **Background retries**: The app automatically retries 3 times with exponential backoff (2s, 4s, 8s)

### Session Initialization Hangs

**Symptoms:**
- App shows loading spinner indefinitely
- Console shows `[AuthContext] Starting session initialization` but no completion

**Causes:**
1. Supabase `getSession()` call hanging
2. Network connectivity issues
3. Supabase API throttling

**Solutions:**
1. **Increase SESSION_TIMEOUT_MS** in `AuthContext.tsx` (currently 15s)
2. **Clear browser cache**: Old cached data might be corrupt
3. **Check network**: Ensure stable connection to Supabase
4. **Fallback mode**: App uses sessionStorage cache when available

## Monitoring

### Logs to Watch

```javascript
// Normal operation
[AuthContext] Profile fetched in 1234ms
[AuthContext] Profile loaded successfully

// Slow but successful
[AuthContext] Profile fetched in 8500ms
[AuthContext] Profile loaded successfully

// Timeout with fallback
[AuthContext] getSession() timed out after 15s
[AuthContext] Using cache after session timeout
[AuthContext] Background retry attempt 1 after 2000ms

// Database timeout
[AuthContext] Profile load timed out, using fallback profile
[AuthContext] Background retry attempt 1 after 2000ms
[AuthContext] Background retry succeeded, profile loaded
```

### Metrics to Track

1. **Time to First Byte (TTFB)** for profile queries
2. **Success rate** of profile loads within timeout
3. **Fallback usage** - How often temporary profiles are used
4. **Background retry success rate**

## Recent Changes (November 2025)

- ✅ Increased profile timeout from 10s to 20s
- ✅ Increased session timeout from 5s to 15s
- ✅ Added exponential backoff retry (3 attempts: 2s, 4s, 8s)
- ✅ Improved error messages with actionable guidance
- ✅ Added performance logging (query duration tracking)
- ✅ Graceful degradation instead of throwing errors

## See Also

- [Session Management](./SESSION_MANAGEMENT.md)
- [Refresh Bug Fix](./REFRESH_BUG_FIX.md)
- [Supabase RLS Policies](./supabase/20250124_profiles_rls_policies.sql)

