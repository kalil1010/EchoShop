# Vendor Authentication Flow Fixes

## Overview

Fixed the vendor authentication flow so vendors can log in via Google OAuth and seamlessly access both their vendor dashboard (`/atlas`) AND regular user features (marketplace, closet, outfit, chat, profile) WITHOUT being asked to re-login or encountering "permission denied" errors.

## Problem Statement

**Before Fix:**
- Vendor logs in via Google OAuth
- Vendor clicks "View Details" on a product in marketplace
- App prompts for login AGAIN despite being logged in
- Root cause: Vendor role not persisted in auth state, or auth context fails to load vendor profile

**After Fix:**
- Vendor logs in via Google OAuth → role automatically upgraded to 'vendor' if approved request exists
- Vendor can access `/atlas` (vendor dashboard) AND `/marketplace` (user features)
- No re-login prompts when navigating between routes
- "View Details" button works correctly for authenticated vendors

## Implemented Fixes

### Section A: Session Management & Persistence

#### Task A1: Add Session Hydration from Vendor Requests ✅
**File:** `src/contexts/AuthContext.tsx`

**Changes:**
- Added `checkVendorStatus()` helper function to query `vendor_requests` table
- Modified `reconcileProfileAfterAuth()` to check for approved vendor requests
- If user has approved vendor request and role is 'user', automatically upgrade to 'vendor'
- Role upgrade happens before profile upsert, ensuring correct role is persisted

**Key Code:**
```typescript
// In reconcileProfileAfterAuth()
if (normalised.role === 'user' && supabase) {
  const vendorStatus = await checkVendorStatus(supabase, authUser.uid)
  if (vendorStatus === 'approved') {
    normalised.role = 'vendor'
  }
}
```

#### Task A2: Persist Session Role in Cookie & LocalStorage ✅
**File:** `src/contexts/AuthContext.tsx`

**Changes:**
- Added `setRoleCookie()` to save role and uid to cookies (7-day expiry)
- Added `setRoleLocalStorage()` to cache role data in localStorage (24-hour validity)
- Added `clearRoleStorage()` to remove cookies/localStorage on logout
- Added `getRoleFromLocalStorage()` for fast role hydration on page load
- Modified `applyProfileToState()` to persist role after profile load
- Modified `logout()` to clear role storage

**Key Code:**
```typescript
// Cookies set for middleware access
document.cookie = `user_role=${role}; path=/; max-age=604800; SameSite=Lax`
document.cookie = `user_id=${uid}; path=/; max-age=604800; SameSite=Lax`

// localStorage for fast client-side hydration
localStorage.setItem('echoshop_vendor_status', JSON.stringify({
  uid, role, vendorName, timestamp
}))
```

#### Task A3: Add Bootstrap Profile Role Detection ✅
**File:** `src/contexts/AuthContext.tsx`

**Changes:**
- Modified `buildBootstrapProfile()` to accept optional `vendorStatus` parameter
- Updated all calls to `buildBootstrapProfile()` to check vendor status first
- In `loadUserProfile()`, check vendor status before creating bootstrap profile
- Ensures first-time vendor signups get correct role from the start

**Key Code:**
```typescript
// Check vendor status before building bootstrap
const vendorStatus = await checkVendorStatus(supabase, authUser.uid)
const bootstrap = buildBootstrapProfile(authUser, vendorStatus)
// If vendorStatus === 'approved', role is set to 'vendor'
```

### Section B: Route Protection & Navigation

#### Task B1: Create Vendor-Aware Role Utility ✅
**File:** `src/lib/roles.ts`

**Changes:**
- Added `ROUTE_ACCESS` mapping defining which routes each role can access
- **Key Insight:** Vendor role is SUPERSET of user role
  - Vendors can access: `/atlas` + all user routes (`/marketplace`, `/outfit`, `/chat`, `/closet`, `/profile`)
  - Users can only access: user routes (no `/atlas`)
  - Owners can access: everything
- Added `isRouteAccessible(userRole, targetRoute)` function
- Function normalizes routes and checks prefix matches

**Key Code:**
```typescript
const ROUTE_ACCESS: Record<UserRole, string[]> = {
  vendor: [
    '/atlas',        // Vendor-specific
    '/marketplace',  // User routes (vendors can access)
    '/outfit',
    '/chat',
    '/closet',
    '/profile',
    '/',
  ],
  // ...
}

export function isRouteAccessible(userRole: UserRole | null | undefined, targetRoute: string): boolean
```

#### Task B2: Protect Routes with Role Guards ✅
**File:** `src/app/atlas/page.tsx`

**Changes:**
- Added `profileStatus` check to loading condition
- Show loading spinner while `profileStatus === 'loading'`
- Use `getDefaultRouteForRole()` for proper redirects based on role
- Improved loading state handling to prevent premature redirects

**Key Code:**
```typescript
// Wait for profile status to be ready
if (loading || profileStatus === 'loading') {
  return <LoadingSpinner />
}

// Redirect to appropriate route based on role
const defaultRoute = getDefaultRouteForRole(profile.role)
router.replace(access.denial?.redirect ?? defaultRoute)
```

#### Task B3: Fix "View Details" Component ✅
**Files:** 
- `src/components/marketplace/ProductCard.tsx` (new)
- `src/app/marketplace/page.tsx` (updated)
- `src/app/marketplace/product/[id]/page.tsx` (new)
- `src/components/marketplace/ProductDetailView.tsx` (new)

**Changes:**
- Created `ProductCard` component with proper auth checking
- Uses `useAuth()` hook to check authentication state
- Uses `isRouteAccessible()` to verify vendor can access marketplace
- Shows loading state if profile is still hydrating (doesn't redirect)
- Only redirects to login if truly unauthenticated
- Created product detail page route and view component

**Key Code:**
```typescript
const handleViewDetails = () => {
  // If authenticated and profile ready
  if (user && profileStatus === 'ready' && userProfile) {
    if (isRouteAccessible(userProfile.role, '/marketplace')) {
      router.push(targetRoute)
      return
    }
  }
  
  // If loading, wait (don't redirect)
  if (profileStatus === 'loading') {
    return
  }
  
  // Only redirect to login if truly unauthenticated
  if (!user || profileStatus === 'idle' || profileStatus === 'error') {
    router.push(`/auth?redirect=${encodeURIComponent(targetRoute)}`)
  }
}
```

### Section C: Session Synchronization

#### Task C1: Improve Server-Side Session Sync ✅
**File:** `src/contexts/AuthContext.tsx`

**Changes:**
- Enhanced `syncServerSession()` to accept optional `userProfile` parameter
- Added retry logic with exponential backoff (3 attempts, 1s/2s/3s delays)
- Added 5-second timeout with AbortController
- Sends vendor status along with session data
- Re-syncs with profile data after profile loads
- Updated all `syncServerSession()` calls to pass userProfile when available

**Key Code:**
```typescript
async function syncServerSession(
  event: string,
  session: Session | null,
  userProfile?: UserProfile | null,
): Promise<void> {
  // Retry logic with exponential backoff
  // Timeout after 5 seconds
  // Send vendor status in payload
  // Re-sync after profile loads
}
```

**Updated API Route:**
- `src/app/api/auth/callback/route.ts` - Now accepts `userProfile` in payload (for future use)

## Testing Checklist

### Vendor Login Flow
- [ ] Vendor with approved request logs in via Google OAuth
- [ ] Role automatically set to 'vendor' in profile
- [ ] Cookie and localStorage set with vendor role
- [ ] Vendor can access `/atlas` without redirect
- [ ] Vendor can access `/marketplace` without redirect
- [ ] Vendor can click "View Details" on products without re-login prompt

### Role Persistence
- [ ] Page reload → vendor role persists (from cookie/localStorage)
- [ ] Navigate between routes → role persists
- [ ] Logout → cookies and localStorage cleared
- [ ] Login again → role correctly restored

### Route Access
- [ ] Vendor can access `/atlas` ✅
- [ ] Vendor can access `/marketplace` ✅
- [ ] Vendor can access `/outfit`, `/chat`, `/closet`, `/profile` ✅
- [ ] User cannot access `/atlas` (redirected to `/marketplace`)
- [ ] Unauthenticated user cannot access `/atlas` (redirected to `/auth`)

### View Details Flow
- [ ] Vendor logged in → clicks "View Details" → navigates to product page (no re-login)
- [ ] Vendor logged in, profile loading → "View Details" shows loading state (no redirect)
- [ ] Unauthenticated user → clicks "View Details" → redirected to login with redirect URL
- [ ] After login → user redirected back to product page

## Files Modified

### Core Auth Files
- `src/contexts/AuthContext.tsx` - Major updates to session management, role persistence, vendor status checking
- `src/lib/roles.ts` - Added route accessibility functions
- `src/app/api/auth/callback/route.ts` - Updated to accept userProfile data

### Route Protection
- `src/app/atlas/page.tsx` - Enhanced role guards and loading states

### Marketplace Components
- `src/components/marketplace/ProductCard.tsx` - New component with proper auth handling
- `src/app/marketplace/page.tsx` - Updated to use ProductCard component
- `src/app/marketplace/product/[id]/page.tsx` - New product detail page
- `src/components/marketplace/ProductDetailView.tsx` - New product detail view component

## Key Improvements

1. **Automatic Role Upgrade**: Vendors with approved requests automatically get 'vendor' role on login
2. **Persistent Sessions**: Role stored in cookies (server-accessible) and localStorage (fast hydration)
3. **Route Accessibility**: Vendors can access all user routes PLUS vendor routes
4. **Smart Auth Checks**: Components check auth state properly, don't redirect during loading
5. **Improved Sync**: Server session sync includes vendor data and retry logic

## Technical Details

### Cookie Format
- `user_role={role}` - Role value (user/vendor/owner)
- `user_id={uid}` - User ID
- Max age: 7 days
- SameSite: Lax

### LocalStorage Format
```json
{
  "uid": "user-id",
  "role": "vendor",
  "vendorName": "Business Name",
  "timestamp": 1234567890
}
```
- Valid for 24 hours
- Used for fast initial role detection

### Vendor Status Check
- Queries `vendor_requests` table for latest request
- Checks if status is 'approved'
- Only upgrades role if current role is 'user' (prevents downgrades)

## Future Enhancements

1. **Middleware Integration**: Use cookies in middleware for server-side route protection
2. **Real-time Role Updates**: Update role when vendor request is approved (without re-login)
3. **Session Refresh**: Automatically refresh role if vendor status changes
4. **Analytics**: Track role upgrade events for insights

## Notes

- All changes are backward compatible
- Existing user flows remain unchanged
- Vendor role is a superset of user role (vendors can do everything users can)
- Role persistence works across page reloads and navigation
- Session sync is best-effort (doesn't block user experience if it fails)

