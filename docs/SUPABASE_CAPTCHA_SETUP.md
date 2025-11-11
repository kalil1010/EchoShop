# Supabase CAPTCHA Configuration Guide

## Problem: 400 Error with Email/Password Authentication

If you're getting a 400 error when trying to sign in or sign up with email/password, but Google OAuth works fine, the issue is likely with your CAPTCHA configuration in Supabase.

## Root Cause

When CAPTCHA protection is **enabled** in Supabase, it requires a valid CAPTCHA token for email/password authentication. If the token validation fails, Supabase returns a 400 error.

## Solution: Verify Supabase CAPTCHA Configuration

### Step 1: Check if CAPTCHA Protection is Enabled

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Settings** → **CAPTCHA Protection**
3. Check if **CAPTCHA protection** is enabled

### Step 2: If CAPTCHA is Enabled - Verify Configuration

If CAPTCHA protection is enabled, you **must** configure it correctly:

#### Option A: Configure Turnstile (Recommended)

1. **Get your Turnstile keys:**
   - Go to [Cloudflare Turnstile Dashboard](https://developers.cloudflare.com/turnstile/)
   - Create a site or use an existing one
   - Copy both the **Site Key** and **Secret Key**

2. **Configure in your app:**
   - Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in your `.env.local` (Site Key)
   - This is already configured in your code

3. **Configure in Supabase:**
   - In Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
   - Select **Cloudflare Turnstile** as the provider
   - Paste the **Secret Key** (NOT the site key) in the "Turnstile Secret Key" field
   - **Important**: The secret key must match the site key (from the same Turnstile site)

4. **Verify the keys match:**
   - Site Key (in `.env.local`) and Secret Key (in Supabase) must be from the same Turnstile site
   - If they don't match, authentication will fail with a 400 error

#### Option B: Disable CAPTCHA Protection (For Testing)

If you don't want to use CAPTCHA protection:

1. Go to Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
2. **Disable** CAPTCHA protection
3. Save the settings
4. Try signing in again

**Note**: Disabling CAPTCHA removes bot protection. Only do this for testing or if you have other bot protection measures.

### Step 3: Verify Environment Variables

1. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in your `.env.local`:
   ```bash
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
   ```

2. Restart your development server after changing environment variables:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

### Step 4: Check Browser Console

After attempting to sign in, check the browser console for detailed error messages:

```javascript
[AuthContext] Supabase sign-in error: {
  status: 400,
  message: "...",
  code: "...",
  description: "...",
  hasCaptchaToken: true
}
```

The error message will tell you exactly what's wrong:
- **"invalid-input-secret"**: The secret key in Supabase doesn't match the site key
- **"captcha_token required"**: CAPTCHA protection is enabled but no token was sent
- **"captcha verification failed"**: The token validation failed

## Common Issues and Solutions

### Issue 1: "invalid-input-secret" Error

**Cause**: The Turnstile secret key in Supabase doesn't match the site key in your environment variables.

**Solution**:
1. Verify both keys are from the same Turnstile site in Cloudflare
2. Double-check that you're using the **Secret Key** in Supabase (not the Site Key)
3. Ensure there are no extra spaces or characters when copying the keys
4. Re-enter the secret key in Supabase Dashboard

### Issue 2: CAPTCHA Token Not Being Sent

**Symptoms**: Error says "captcha_token required" or similar

**Solution**:
1. Verify `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in `.env.local`
2. Check that the Turnstile widget appears on the login/signup page
3. Verify the widget completes successfully (check browser console)
4. Ensure the token is being passed to the sign-in function (check console logs)

### Issue 3: CAPTCHA Protection Enabled But No Widget

**Symptoms**: Getting 400 errors but no CAPTCHA widget appears

**Solution**:
1. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
2. Verify the site key is valid (check Cloudflare Turnstile dashboard)
3. Check browser console for CSP errors (Content Security Policy blocking scripts)
4. Clear browser cache and hard refresh

### Issue 4: Google OAuth Works But Email/Password Doesn't

**Cause**: CAPTCHA protection is enabled for email/password but not for OAuth providers.

**Solution**:
1. This is expected behavior - OAuth providers don't require CAPTCHA
2. Fix the CAPTCHA configuration for email/password authentication (see steps above)
3. Or disable CAPTCHA protection if you don't need it

## Testing the Configuration

### Test 1: Verify CAPTCHA Widget Loads
1. Go to login page
2. Verify Turnstile widget appears
3. Complete the CAPTCHA
4. Check browser console for token generation log

### Test 2: Verify Token is Sent
1. Complete CAPTCHA
2. Enter email and password
3. Click sign in
4. Check browser console for: `[AuthContext] Signing in with CAPTCHA token`
5. Check Network tab for the auth request
6. Verify request includes `captchaToken` in the payload

### Test 3: Verify Supabase Validation
1. Check browser console for detailed error messages
2. If you see "invalid-input-secret", the secret key is wrong
3. If you see "captcha verification failed", check Supabase configuration

## Debugging Steps

1. **Enable detailed logging:**
   - Check browser console for `[AuthContext] Supabase sign-in error`
   - Look for the `description` field which contains the actual error message

2. **Check Network tab:**
   - Open DevTools → Network tab
   - Filter by "auth" or "token"
   - Find the failed request to `/auth/v1/token?grant_type=password`
   - Check the request payload and response

3. **Verify Supabase Dashboard:**
   - Go to Authentication → Settings → CAPTCHA Protection
   - Verify CAPTCHA protection status
   - Verify provider is set to "Cloudflare Turnstile"
   - Verify secret key is set (you won't see the actual key, but it should show as configured)

4. **Test with CAPTCHA disabled:**
   - Temporarily disable CAPTCHA protection in Supabase
   - Try signing in again
   - If it works, the issue is with CAPTCHA configuration
   - If it still fails, the issue is with something else

## Quick Fix Checklist

- [ ] CAPTCHA protection is enabled in Supabase
- [ ] Turnstile provider is selected in Supabase
- [ ] Turnstile Secret Key is set in Supabase (NOT the Site Key)
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in `.env.local` (Site Key)
- [ ] Site Key and Secret Key are from the same Turnstile site
- [ ] Development server was restarted after changing environment variables
- [ ] Browser cache was cleared
- [ ] Turnstile widget appears on login page
- [ ] CAPTCHA completes successfully
- [ ] Token is being sent in the auth request

## Still Having Issues?

1. Check the browser console for the detailed error message from `[AuthContext] Supabase sign-in error`
2. Verify both keys are from the same Turnstile site
3. Try creating a new Turnstile site and using those keys
4. Check Supabase logs for server-side errors
5. Verify your Supabase project has the latest updates
6. Contact Supabase support if the issue persists

## Related Documentation

- [Turnstile Troubleshooting Guide](./TURNSTILE_TROUBLESHOOTING.md)
- [CAPTCHA Implementation Guide](./CAPTCHA_IMPLEMENTATION.md)
- [Supabase CAPTCHA Documentation](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)

