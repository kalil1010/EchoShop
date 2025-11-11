# Turnstile Error 400020 - Complete Solution Guide

## Problem Summary

You're experiencing **Cloudflare Turnstile Error 400020** with the following symptoms:
- CAPTCHA widget fails to load
- 400 errors from `challenges.cloudflare.com`
- Error message: "CAPTCHA configuration error. Please verify your Turnstile site key matches the secret key in Supabase."
- Console error: `[Cloudflare Turnstile] Error: 400020`

## Root Cause Analysis

Error 400020 from Cloudflare Turnstile indicates one of these issues (in order of likelihood):

### 1. Domain Not in Allowed Domains List (MOST COMMON) ⚠️
**Likelihood:** 80%

Your domain is not listed in the **Allowed Domains** section of your Cloudflare Turnstile site settings. This is the most common cause of error 400020.

**Solution:**
1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click on your Turnstile site
3. Scroll to **Allowed Domains**
4. Add your domain(s):
   - `localhost` (for development)
   - `yourdomain.com` (for production)
   - `*.railway.app` (if using Railway's default domain)
   - Your custom Railway domain (if configured)

### 2. Invalid Site Key
**Likelihood:** 10%

The site key doesn't exist, has been revoked, or belongs to a different Cloudflare account.

**Solution:**
1. Verify the site key in Cloudflare Turnstile Dashboard
2. Check that the site is **Active** (not disabled)
3. Verify the site key matches what's in Railway
4. If invalid, create a new Turnstile site and update both keys

### 3. Site Key Format Invalid
**Likelihood:** 5%

The site key format is incorrect (wrong length, invalid characters, extra spaces).

**Solution:**
1. Verify site key starts with `0x4AAAAAAA` or similar
2. Check for extra spaces before/after the key
3. Verify site key length is 40-100 characters
4. Copy the site key fresh from Cloudflare (don't use cached copy)

### 4. Site Key and Secret Key Mismatch
**Likelihood:** 5%

The site key and secret key are from different Turnstile sites or don't match.

**Solution:**
1. Verify both keys are from the **same Turnstile site** in Cloudflare
2. Copy both keys fresh from Cloudflare
3. Update Site Key in Railway
4. Update Secret Key in Supabase Dashboard
5. Wait 1-2 minutes for changes to propagate

## Step-by-Step Fix

### Step 1: Check Diagnostic Endpoint

Use the diagnostic endpoint to verify your configuration:

```bash
# In production
curl https://your-domain.com/api/turnstile-diagnostic

# In development
curl http://localhost:3000/api/turnstile-diagnostic
```

This will show:
- Site key is configured
- Site key format is valid
- Domain information
- Recommendations

### Step 2: Verify Site Key in Railway

1. Go to **Railway Dashboard** → Your Project → Variables
2. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
3. Copy the site key value
4. Verify it starts with `0x4AAAAAAA` or similar
5. Make sure there are no extra spaces

### Step 3: Check Allowed Domains in Cloudflare

**THIS IS THE MOST IMPORTANT STEP** ⚠️

1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click on your Turnstile site
3. Scroll to **Allowed Domains**
4. Add your domain(s):
   - For Railway: Add `*.railway.app` and your custom domain
   - For localhost: Add `localhost`
   - For production: Add `yourdomain.com` and `www.yourdomain.com`

**Critical:** Domains are case-insensitive, but you must include:
- The exact domain (e.g., `example.com`)
- Subdomains if used (e.g., `www.example.com`)
- Wildcards if using Railway's default domain (e.g., `*.railway.app`)

### Step 4: Verify Secret Key in Supabase

1. Go to **Supabase Dashboard** → Authentication → Settings → CAPTCHA Protection
2. Verify **CAPTCHA protection is enabled**
3. Verify **Cloudflare Turnstile** is selected as the provider
4. Check the **Turnstile Secret Key** field:
   - Must match the Secret Key from the same Turnstile site
   - Must NOT be the Site Key (common mistake)
   - Must have no extra spaces
   - Should start with `0x4AAAAAAA` or similar

### Step 5: Test the Fix

1. **Clear browser cache** or use incognito mode
2. **Redeploy your Railway app** (if you changed environment variables)
3. **Wait 1-2 minutes** after updating Cloudflare/Supabase settings
4. **Open your app** in a browser
5. **Check browser console** for Turnstile errors
6. **Verify CAPTCHA widget loads** on login/signup page

## Quick Checklist

Use this checklist to verify your configuration:

- [ ] Site key is set in Railway: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] Site key format is valid (starts with `0x4AAAAAAA`)
- [ ] Site key is from an active Turnstile site in Cloudflare
- [ ] **Your domain is in the allowed domains list in Cloudflare** ⚠️
- [ ] Secret key is set in Supabase Dashboard
- [ ] Secret key matches the site key (from same Turnstile site)
- [ ] CAPTCHA protection is enabled in Supabase
- [ ] Cloudflare Turnstile is selected as provider in Supabase
- [ ] No extra spaces in site key or secret key
- [ ] Railway app has been redeployed (if env vars changed)
- [ ] Waited 1-2 minutes after updating settings
- [ ] Cleared browser cache or using incognito mode
- [ ] Diagnostic endpoint shows site key is configured
- [ ] Browser console shows no CSP violations

## Common Mistakes

### Mistake 1: Domain Not in Allowed Domains
**Symptom:** Error 400020, CAPTCHA doesn't load

**Solution:** Add your domain to allowed domains in Cloudflare Turnstile Dashboard

### Mistake 2: Using Site Key Instead of Secret Key in Supabase
**Symptom:** Error 400020, CAPTCHA loads but verification fails

**Solution:** Use the Secret Key (not Site Key) in Supabase Dashboard

### Mistake 3: Keys from Different Sites
**Symptom:** Error 400020, keys don't match

**Solution:** Ensure both keys are from the same Turnstile site in Cloudflare

### Mistake 4: Extra Spaces in Keys
**Symptom:** Error 400020, keys appear correct but don't work

**Solution:** Remove any spaces before/after the keys

## Diagnostic Tools

### 1. Diagnostic Endpoint
```bash
curl https://your-domain.com/api/turnstile-diagnostic
```

### 2. Browser Console
Open browser console (F12) and check for:
- Turnstile errors
- CSP violations
- Network errors to `challenges.cloudflare.com`

### 3. Cloudflare Dashboard
1. Go to Cloudflare Turnstile Dashboard
2. Check site status
3. Verify allowed domains
4. Check site key and secret key

### 4. Supabase Dashboard
1. Go to Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
2. Verify CAPTCHA protection is enabled
3. Verify Cloudflare Turnstile is selected
4. Verify secret key is set

## Still Having Issues?

If you've followed all steps and still get error 400020:

1. **Create a new Turnstile site:**
   - Go to Cloudflare Turnstile Dashboard
   - Create a new site
   - Get new Site Key and Secret Key
   - Update Railway and Supabase with new keys

2. **Check Cloudflare account:**
   - Verify you're using the correct Cloudflare account
   - Check if the site key belongs to a different account

3. **Verify domain configuration:**
   - Check your Railway domain configuration
   - Verify custom domain is properly configured
   - Check DNS settings

4. **Test with localhost:**
   - Add `localhost` to allowed domains
   - Test locally to isolate the issue
   - If localhost works, the issue is domain-specific

5. **Contact Cloudflare Support:**
   - If the site key is valid but still getting 400020
   - Provide site key and domain information
   - Check Cloudflare status page for outages

## Files Created/Updated

1. **`src/app/api/turnstile-diagnostic/route.ts`** - Diagnostic endpoint
2. **`docs/TURNSTILE_ERROR_400020_FIX.md`** - Comprehensive troubleshooting guide
3. **`src/components/auth/SignUpForm.tsx`** - Improved error messages
4. **`src/components/auth/LoginForm.tsx`** - Improved error messages

## Next Steps

1. ✅ Use the diagnostic endpoint to check your configuration
2. ✅ Verify your domain is in the allowed domains list (MOST IMPORTANT)
3. ✅ Check site key and secret key match
4. ✅ Clear cache and test again
5. ✅ If still having issues, create a new Turnstile site

## Additional Resources

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile Troubleshooting Guide](./TURNSTILE_TROUBLESHOOTING.md)
- [Fix Invalid Input Secret](./FIX_INVALID_INPUT_SECRET.md)
- [Supabase CAPTCHA Setup](./SUPABASE_CAPTCHA_SETUP.md)

---

## Quick Fix Summary

**Most likely cause:** Domain not in allowed domains list in Cloudflare

**Quick fix:**
1. Go to Cloudflare Turnstile Dashboard
2. Click on your Turnstile site
3. Add your domain to **Allowed Domains**
4. Wait 1-2 minutes
5. Clear browser cache and test again

If that doesn't work, follow the complete step-by-step fix above.

