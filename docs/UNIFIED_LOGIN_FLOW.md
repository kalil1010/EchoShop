# Unified Login Flow Implementation

## Overview
The login flow has been refactored to use a single entry point (`/auth`) where users enter credentials once, and the system automatically detects their role and routes them to the appropriate dashboard.

## Key Changes

### 1. Single Login Entry Point
- **All users** (user/admin/vendor) now log in through `/auth`
- Removed separate login pages for different roles
- `/downtown` and `/atlas` now redirect to `/auth` if user is not authenticated or has wrong role

### 2. Automatic Role Detection & Routing
- After authentication, system detects user role from profile
- Auto-routes to correct dashboard:
  - **Users** → `/` (home) or `/profile`
  - **Vendors** → `/atlas`
  - **Owners** → `/downtown/dashboard`

### 3. Automatic Profile Creation
- If user profile is missing after authentication, it's automatically created with default `user` role
- Profile creation happens in `AuthContext.loadUserProfile()`
- Uses `buildBootstrapProfile()` which always defaults to `DEFAULT_ROLE` ('user')

### 4. Middleware Updates
- All unauthenticated users are redirected to `/auth` (except public routes)
- Redirect URL is preserved in query params: `/auth?redirect=/downtown`
- Wrong role access attempts redirect to `/auth` with role info: `/auth?redirect=/downtown&role=vendor`

### 5. Access Denial Handling
- Clear error banners shown on login page when:
  - User has wrong role for requested portal
  - Profile is missing
  - Session expired
- `AccessDeniedBanner` component provides user-friendly guidance
- Upgrade pathways shown in user dashboards

### 6. Upgrade Pathways
- **User Profile Page**: Shows `UpgradePathwayBanner` with vendor upgrade option
- **Vendor Hub**: Already has vendor application form
- Clear CTAs to request role upgrades

## Implementation Details

### Files Modified

1. **`src/middleware.ts`**
   - Redirects all unauthenticated users to `/auth` with redirect param
   - Redirects wrong-role users to `/auth` with role info
   - Maintains strict access enforcement

2. **`src/components/auth/LoginForm.tsx`**
   - Handles redirect parameters from URL
   - Shows access denial banners when wrong role detected
   - Auto-routes to correct dashboard after successful login
   - Respects redirect path if user has correct role

3. **`src/app/downtown/page.tsx`**
   - Redirects to `/auth` if not authenticated
   - Redirects to `/auth` if user has wrong role
   - Only allows owner role to proceed

4. **`src/app/atlas/page.tsx`**
   - Redirects to `/auth` if not authenticated
   - Redirects to `/auth` if user has wrong role
   - Only allows vendor role to proceed

5. **`src/app/auth/page.tsx`**
   - Wrapped in Suspense for searchParams support
   - Single entry point for all authentication

6. **`src/contexts/AuthContext.tsx`**
   - `buildBootstrapProfile()` always uses `DEFAULT_ROLE` ('user')
   - `loadUserProfile()` auto-creates profile if missing
   - Profile creation happens automatically on sign-in

7. **`src/components/auth/AccessDeniedBanner.tsx`** (NEW)
   - Displays clear error messages
   - Provides action buttons for upgrade pathways
   - Supports different notice tones (info, warning, danger)

8. **`src/components/profile/UpgradePathwayBanner.tsx`** (NEW)
   - Shows upgrade options for regular users
   - Links to vendor hub for vendor upgrade
   - Provides support contact for owner access

9. **`src/app/profile/page.tsx`**
   - Added `UpgradePathwayBanner` component
   - Shows upgrade pathways to users

## User Flow

### New User Sign-Up
1. User visits `/auth` and signs up
2. Profile automatically created with `user` role
3. User redirected to home page or profile page
4. Upgrade banner shown on profile page

### Existing User Login
1. User visits any protected route (e.g., `/downtown`, `/atlas`, `/profile`)
2. If not authenticated → redirected to `/auth?redirect=/original-path`
3. User enters credentials once
4. System detects role from profile
5. User auto-routed to appropriate dashboard:
   - If role matches requested portal → goes to requested path
   - If role doesn't match → redirected to role's default dashboard
   - If profile missing → profile created with `user` role, then routed

### Wrong Role Access Attempt
1. User with `user` role tries to access `/downtown`
2. Middleware detects wrong role
3. Redirects to `/auth?redirect=/downtown&role=user`
4. LoginForm shows `AccessDeniedBanner` with upgrade pathway
5. User can sign in and will be routed to their correct dashboard

### Missing Profile
1. User authenticates but profile doesn't exist
2. `AuthContext.loadUserProfile()` detects missing profile
3. Creates bootstrap profile with `user` role
4. User continues with limited functionality until profile syncs
5. Toast notification shown about profile creation

## Access Enforcement

### Middleware Level
- Checks authentication status
- Validates role against portal requirements
- Redirects with clear error context

### API Route Level
- `requireRole()` function enforces role checks
- Returns 403 Forbidden for wrong roles
- Maintains security even if middleware bypassed

### Component Level
- Pages check role and show appropriate content
- Access denied banners guide users
- Upgrade pathways always visible

## Error Messages

### Session Expired
- Clear message: "Your session has expired"
- Action: "Sign In Again" button
- Shown when tokens expire

### Wrong Role
- Banner explains why access was denied
- Shows current role vs required role
- Provides upgrade pathway or redirect to correct dashboard

### Missing Profile
- Info message: "Profile setup required"
- Explains profile will be created automatically
- User can continue after sign-in

## Testing Checklist

- [ ] New user sign-up creates profile with `user` role
- [ ] User login routes to home/profile
- [ ] Vendor login routes to `/atlas`
- [ ] Owner login routes to `/downtown/dashboard`
- [ ] Wrong role access shows error banner
- [ ] Missing profile auto-creates on login
- [ ] Redirect parameters preserved through login flow
- [ ] Middleware blocks unauthenticated access
- [ ] API routes enforce role checks
- [ ] Upgrade pathways visible in user dashboard

## Migration Notes

### For Existing Users
- All existing login pages (`/downtown`, `/atlas`, `/vendor/login`) now redirect to `/auth`
- Existing sessions continue to work
- Profile auto-creation ensures all users have profiles

### For Developers
- Use `/auth` as the single login entry point
- Check `redirect` query param for post-login routing
- Use `AccessDeniedBanner` for access errors
- Profile creation is automatic - no manual intervention needed

## Security Considerations

1. **Strict Middleware Enforcement**: All protected routes checked
2. **API Route Guards**: Double-layer security with `requireRole()`
3. **Role Validation**: Always normalizes and validates roles
4. **Session Management**: Proper handling of expired sessions
5. **Cookie Security**: Secure cookie handling in middleware

## Future Enhancements

- Add session expiry detection in components
- Add "Remember me" functionality
- Add multi-factor authentication support
- Add role upgrade request tracking
- Add admin approval workflow UI

