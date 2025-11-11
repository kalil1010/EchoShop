# Turnstile CAPTCHA Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "CAPTCHA verification failed" with 400 error from Supabase

**Symptoms:**
- Error: `The CAPTCHA verification failed. Please refresh the page and complete the CAPTCHA again.`
- Supabase returns 400 error on `/auth/v1/token?grant_type=password`
- Browser console shows: `Failed to load resource: the server responded with a status of 400 ()`

**Causes:**
1. **Turnstile Secret Key Mismatch**: The secret key in Supabase Dashboard doesn't match the site key
2. **CAPTCHA Protection Not Enabled**: CAPTCHA protection is not enabled in Supabase
3. **Token Expiration**: The CAPTCHA token expired before being sent to Supabase
4. **Invalid Site Key**: The site key in environment variables is incorrect

**Solutions:**

#### Step 1: Verify Supabase Configuration
1. Go to Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
2. Ensure **CAPTCHA protection is enabled**
3. Select **Cloudflare Turnstile** as the provider
4. Verify the **Turnstile Secret Key** matches your Cloudflare Turnstile site

#### Step 2: Verify Environment Variables
1. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in your `.env.local`
2. Verify the site key matches the one in Cloudflare Turnstile dashboard
3. Restart your development server after changing environment variables

#### Step 3: Verify Site Key and Secret Key Match
- In Cloudflare Turnstile dashboard, create a site and get both:
  - **Site Key** (public) → Goes in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - **Secret Key** (private) → Goes in Supabase Dashboard CAPTCHA settings
- **Important**: The site key and secret key must be from the same Turnstile site

#### Step 4: Test Token Generation
1. Open browser console
2. Complete the CAPTCHA on the login page
3. Check console for log message showing token was generated
4. Verify token is sent to Supabase (check Network tab)

### Issue 2: CSP Violations and Script Blocking

**Symptoms:**
- Browser console shows: `Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback`
- Turnstile widget doesn't load
- CSP errors in console

**Solutions:**
1. Verify `next.config.mjs` has correct CSP headers
2. Restart the development server after changing `next.config.mjs`
3. Clear browser cache and hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
4. Check that headers are being applied (inspect Network tab → Response Headers)

### Issue 3: Permissions Policy Violations

**Symptoms:**
- Browser console shows: `Potential permissions policy violation: autoplay is not allowed`
- Browser console shows: `Potential permissions policy violation: fullscreen is not allowed`

**Solutions:**
1. Verify `next.config.mjs` allows autoplay and fullscreen for Cloudflare
2. The permissions policy should include:
   ```
   fullscreen=(self https://challenges.cloudflare.com)
   autoplay=(self https://challenges.cloudflare.com)
   ```
3. Restart development server after changes

### Issue 4: 401 Error from Cloudflare Challenge Platform

**Symptoms:**
- Browser console shows: `challenges.cloudflare.com/cdn-cgi/challenge-platform/... Failed to load resource: the server responded with a status of 401 ()`
- "Request for the Private Access Token challenge" message

**Causes:**
- Cloudflare is trying to verify the request but failing
- This might be related to Cloudflare's PAT (Private Access Token) system
- Usually not a blocking issue if Turnstile widget loads correctly

**Solutions:**
1. This is often a non-blocking issue if the Turnstile widget works
2. Verify the CSP allows `https://*.cloudflare.com` in `connect-src`
3. Check if your domain is properly configured in Cloudflare (if using Cloudflare)

### Issue 5: Token Expiration

**Symptoms:**
- CAPTCHA completes successfully
- User waits before submitting
- Token expires and sign-in fails

**Solutions:**
1. Turnstile tokens expire after ~5 minutes
2. The widget automatically handles expiration and shows a notification
3. User needs to complete CAPTCHA again if token expired
4. This is expected behavior and not a bug

## Debugging Steps

### 1. Enable Detailed Logging
Check browser console for:
- CAPTCHA token generation logs
- Token length and prefix (first 10 characters)
- Supabase request/response details

### 2. Check Network Tab
1. Open browser DevTools → Network tab
2. Filter by "turnstile" or "auth"
3. Check requests to:
   - `challenges.cloudflare.com` (Turnstile API)
   - `*.supabase.co/auth/v1/token` (Supabase auth)
4. Verify request payload includes `captchaToken`
5. Check response status and error messages

### 3. Verify Supabase Configuration
1. Go to Supabase Dashboard
2. Check Authentication → Settings → CAPTCHA Protection
3. Verify:
   - CAPTCHA protection is **enabled**
   - Provider is **Cloudflare Turnstile**
   - Secret key is set and matches your Turnstile site

### 4. Test with Different Browsers
- Some browsers have stricter CSP enforcement
- Test in Chrome, Firefox, and Safari
- Check if issue is browser-specific

### 5. Test in Incognito/Private Mode
- Rules out browser extensions interfering
- Clears cached CSP headers
- Tests fresh session

## Configuration Checklist

- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in `.env.local`
- [ ] Turnstile Secret Key is set in Supabase Dashboard
- [ ] Site key and secret key are from the same Turnstile site
- [ ] CAPTCHA protection is enabled in Supabase
- [ ] Cloudflare Turnstile is selected as provider in Supabase
- [ ] `next.config.mjs` has correct CSP headers
- [ ] `next.config.mjs` has correct permissions policy
- [ ] Development server was restarted after config changes
- [ ] Browser cache was cleared

## Testing the Configuration

1. **Test CAPTCHA Widget Loads:**
   - Go to login page
   - Verify Turnstile widget appears
   - No console errors about script loading

2. **Test CAPTCHA Completion:**
   - Complete the CAPTCHA
   - Verify token is generated (check console logs)
   - Widget should show success state

3. **Test Sign-In with CAPTCHA:**
   - Enter email and password
   - Complete CAPTCHA
   - Submit form
   - Verify sign-in succeeds
   - Check Network tab for successful auth request

4. **Test Error Handling:**
   - Try signing in without completing CAPTCHA
   - Verify appropriate error message
   - Try with expired token (wait 5+ minutes after completing CAPTCHA)
   - Verify token expiration is handled

## Common Configuration Mistakes

1. **Mismatched Keys**: Site key and secret key from different Turnstile sites
2. **Wrong Provider**: Using reCAPTCHA secret key with Turnstile site key
3. **Missing Environment Variable**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` not set
4. **CAPTCHA Not Enabled**: CAPTCHA protection disabled in Supabase
5. **Stale Configuration**: Not restarting server after config changes
6. **CSP Too Restrictive**: CSP blocking Cloudflare resources

## Getting Help

If issues persist:
1. Check browser console for detailed error messages
2. Check Network tab for failed requests
3. Verify all configuration steps above
4. Test in incognito mode to rule out extensions
5. Check Supabase logs for server-side errors
6. Review Cloudflare Turnstile documentation

## Related Documentation

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Supabase CAPTCHA Documentation](https://supabase.com/docs/guides/auth/auth-captcha)
- [CAPTCHA Implementation Guide](./CAPTCHA_IMPLEMENTATION.md)

