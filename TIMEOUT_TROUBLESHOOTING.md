# Session Timeout Troubleshooting Guide

## Issue: "Profile sync is delayed" Error

If you're seeing this error message, it means the Supabase `getSession()` call is taking longer than 20 seconds. This guide will help you diagnose and fix the issue.

### Error Message
```
Profile sync is delayed.
Profile loading is taking longer than expected. This could be due to network latency or high server load. Your session is active, and we're retrying in the background.
```

### Console Log
```
[AuthContext] getSession() timed out after 20s
[AuthContext] No valid cache after timeout, cleaning up
```

## Root Causes

### 1. Supabase Connection Issues
**Symptoms:**
- Happens on every login attempt
- Occurs in production and development
- Network tab shows pending Supabase requests

**Solutions:**
```bash
# Check if Supabase is reachable
curl https://YOUR_PROJECT.supabase.co/rest/v1/

# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Verify in browser console
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### 2. Slow Network Connection
**Symptoms:**
- Only happens on slow networks (3G, throttled)
- Works fine on fast WiFi
- Other API calls are also slow

**Solutions:**
- The app will use cached data if available
- Background retry will attempt to restore session (3 attempts)
- User can continue with basic features

### 3. First-Time Login (No Cache)
**Symptoms:**
- Only happens on very first login
- Subsequent refreshes work fine
- Cache is empty in sessionStorage

**Solutions:**
- This is expected behavior on first login with slow connections
- The final retry (10s timeout) will catch most cases
- User experience: slight delay on first login only

### 4. Supabase Service Issues
**Symptoms:**
- Happens for all users
- Supabase dashboard shows high latency
- Status page shows incidents

**Solutions:**
- Check Supabase status: https://status.supabase.com
- Monitor Supabase dashboard for performance metrics
- Consider upgrading Supabase plan for better performance

## Quick Fixes

### For Users (Client-Side)

1. **Clear Cache and Retry**
   ```javascript
   // Browser DevTools Console
   sessionStorage.removeItem('echoshop_session_cache')
   localStorage.removeItem('echoshop_session_cache_backup')
   location.reload()
   ```

2. **Check Network**
   - Open DevTools > Network tab
   - Look for failed or pending Supabase requests
   - Check if throttling is enabled (should be "No throttling")

3. **Wait for Retry**
   - The app will retry 3 times in the background
   - Each retry has increasing delays: 3s, 6s, 9s
   - Total wait time: ~18 seconds before giving up

### For Developers

1. **Increase Timeout (if needed)**
   ```typescript
   // src/contexts/AuthContext.tsx
   const SESSION_TIMEOUT_MS = 30000 // 30 seconds (currently 20s)
   ```

2. **Check Supabase Configuration**
   ```typescript
   // src/lib/supabaseClient.ts
   const client = createClient(url, anonKey, {
     auth: {
       autoRefreshToken: true,
       persistSession: true,
       detectSessionInUrl: true,
     },
     // Add these for better performance
     global: {
       headers: {
         'x-client-info': 'echoshop-web'
       }
     },
     db: {
       schema: 'public'
     },
     realtime: {
       timeout: 20000 // Match session timeout
     }
   })
   ```

3. **Monitor Performance**
   ```javascript
   // Add to your monitoring/analytics
   const startTime = Date.now()
   supabase.auth.getSession().then(() => {
     const duration = Date.now() - startTime
     console.log(`getSession took ${duration}ms`)
     // Send to analytics if > 10000ms
   })
   ```

## Improved Behavior (Current Implementation)

### Timeout Flow
1. **Initial attempt**: 20 seconds timeout
2. **If timeout + has cache**: Use cache, retry in background (3 attempts)
3. **If timeout + no cache**: Final retry with 10s timeout
4. **If all fail**: Show error, allow user to retry manually

### Retry Logic
```typescript
// Automatic background retries with exponential backoff
Attempt 1: Immediate (0s delay)
Attempt 2: After 3 seconds
Attempt 3: After 6 seconds (total: 9s)
Attempt 4: After 9 seconds (total: 18s)
```

### User Experience
- ✅ Instant content on refresh (if cache exists)
- ✅ Background restoration doesn't block UI
- ✅ Graceful degradation on network issues
- ✅ Clear error messages
- ⚠️ Slight delay on first login with slow connection

## Testing Checklist

### Test Scenario 1: Fast Connection
```bash
# Expected: No timeout, session loads in < 2s
1. Clear all caches
2. Log in
3. Check console: Should NOT see timeout messages
```

### Test Scenario 2: Slow Connection
```bash
# Expected: Uses cache or retries successfully
1. Open DevTools > Network
2. Set throttling to "Slow 3G"
3. Refresh page
4. Check: Content should appear from cache
5. Check: Background retry should succeed
```

### Test Scenario 3: First Login + Slow Connection
```bash
# Expected: Final retry succeeds or shows helpful error
1. Clear all caches
2. Set network to "Slow 3G"
3. Log in
4. Wait up to 30 seconds
5. Check: Should either login successfully or show clear error
```

### Test Scenario 4: Offline
```bash
# Expected: Uses cache, shows offline indicator
1. Log in normally
2. Go offline (DevTools > Network > Offline)
3. Refresh page
4. Check: Content appears from cache
5. Check: Shows "offline" indicator
```

## Monitoring Recommendations

### Key Metrics to Track

1. **Session Restoration Time**
   ```javascript
   // Track in your analytics
   {
     metric: 'session_restore_time',
     duration: durationMs,
     hadCache: boolean,
     succeeded: boolean
   }
   ```

2. **Timeout Rate**
   ```javascript
   // Track percentage of timeouts
   {
     metric: 'session_timeout_rate',
     percentage: (timeouts / totalAttempts) * 100
   }
   ```

3. **Cache Hit Rate**
   ```javascript
   // Track cache effectiveness
   {
     metric: 'cache_hit_rate',
     percentage: (cacheHits / totalLoads) * 100
   }
   ```

### Alert Thresholds
- 🚨 **Critical**: Timeout rate > 10%
- ⚠️ **Warning**: Average restore time > 5 seconds
- ℹ️ **Info**: Cache hit rate < 80%

## Environment Variables Check

Make sure these are set:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional (for better performance)
NEXT_PUBLIC_PROFILE_TIMEOUT=20000
```

## Supabase Configuration Check

### Database
1. Check if RLS policies are optimized
2. Add indexes on frequently queried columns:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
   CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
   ```

### Connection Pooling
- Check Supabase dashboard > Settings > Database
- Ensure connection pooling is enabled
- Consider upgrading plan if hitting connection limits

### API Performance
- Check Supabase dashboard > API
- Monitor average response times
- Check for rate limiting

## When to Contact Support

Contact Supabase support if:
- ✅ Timeout happens for > 10% of users
- ✅ Average getSession() time > 10 seconds
- ✅ Supabase dashboard shows high latency
- ✅ Issue persists across all networks and devices

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Performance Optimization Guide](docs/REFRESH_PERFORMANCE_IMPROVEMENTS.md)
- [Session Cache Strategy](docs/REFRESH_BUG_FIX.md)
- [Supabase Status Page](https://status.supabase.com)

---

**Last Updated**: 2025-01-18  
**Version**: 2.0 (With retry logic)

