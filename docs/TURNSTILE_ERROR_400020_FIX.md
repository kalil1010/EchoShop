# Fixing Cloudflare Turnstile Error 400020

## Error Overview

**Error Code:** 400020  
**Error Message:** `[Cloudflare Turnstile] Error: 400020`  
**Symptoms:**
- CAPTCHA widget fails to load
- 400 errors from `challenges.cloudflare.com`
- Error message: "CAPTCHA configuration error. Please verify your Turnstile site key matches the secret key in Supabase."

## Root Causes

Error 400020 from Cloudflare Turnstile indicates one of these issues:

1. **Invalid Site Key** - The site key doesn't exist or has been revoked
2. **Domain Not Allowed** - Your domain is not in the allowed domains list in Cloudflare
3. **Site Key Format Invalid** - The site key format is incorrect
4. **Site Key from Different Account** - The site key belongs to a different Cloudflare account
5. **Site Key Disabled** - The Turnstile site has been disabled in Cloudflare

## Step-by-Step Fix

### Step 1: Verify Site Key in Railway

1. Go to **Railway Dashboard** → Your Project → Variables
2. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
3. Copy the site key value
4. Verify it starts with `0x4AAAAAAA` or similar
5. Make sure there are no extra spaces before/after

### Step 2: Check Site Key in Cloudflare

1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Find your Turnstile site
3. Verify the **Site Key** matches what's in Railway
4. Check that the site is **Active** (not disabled)
5. Verify your domain is in the **Allowed Domains** list

**Critical:** Your domain must be in the allowed domains list. Common issues:
- Domain not added: `example.com` is not in the list
- Subdomain mismatch: `www.example.com` vs `example.com`
- Port numbers: `example.com:3000` (ports are ignored, but verify the domain)
- Protocol: `https://example.com` (use just the domain: `example.com`)

### Step 3: Verify Allowed Domains in Cloudflare

In Cloudflare Turnstile Dashboard:

1. Click on your Turnstile site
2. Scroll to **Allowed Domains**
3. Add your domain(s):
   - `localhost` (for development)
   - `yourdomain.com` (for production)
   - `www.yourdomain.com` (if using www)
   - `*.railway.app` (if using Railway's default domain)
   - Your custom Railway domain (if configured)

**Important:** 
- Domains are case-insensitive
- Don't include `https://` or ports
- Use `localhost` for local development
- Add both `example.com` and `www.example.com` if needed

### Step 4: Verify Secret Key in Supabase

1. Go to **Supabase Dashboard** → Authentication → Settings → CAPTCHA Protection
2. Verify **CAPTCHA protection is enabled**
3. Verify **Cloudflare Turnstile** is selected as the provider
4. Check the **Turnstile Secret Key** field:
   - Must match the Secret Key from the same Turnstile site
   - Must NOT be the Site Key (common mistake)
   - Must have no extra spaces
   - Should start with `0x4AAAAAAA` or similar

### Step 5: Use Diagnostic Endpoint

Check the diagnostic endpoint to verify configuration:

```bash
# In production
curl https://your-domain.com/api/turnstile-diagnostic

# In development
curl http://localhost:3000/api/turnstile-diagnostic
```

The response will show:
- Site key is configured
- Site key format is valid
- Domain information
- Recommendations

### Step 6: Test the Fix

1. **Clear browser cache** or use incognito mode
2. **Redeploy your Railway app** (if you changed environment variables)
3. **Wait 1-2 minutes** after updating Cloudflare/Supabase settings
4. **Open your app** in a browser
5. **Check browser console** for Turnstile errors
6. **Verify CAPTCHA widget loads** on login/signup page

## Common Issues and Solutions

### Issue 1: Domain Not in Allowed Domains

**Symptom:** Error 400020, CAPTCHA doesn't load

**Solution:**
1. Go to Cloudflare Turnstile Dashboard
2. Add your domain to allowed domains:
   - For Railway: Add `*.railway.app` and your custom domain
   - For localhost: Add `localhost`
   - For production: Add `yourdomain.com` and `www.yourdomain.com`

### Issue 2: Site Key Format Invalid

**Symptom:** Error 400020, site key doesn't match expected format

**Solution:**
1. Verify site key in Cloudflare Turnstile Dashboard
2. Copy the site key fresh (don't use cached copy)
3. Update `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Railway
4. Make sure there are no extra spaces
5. Redeploy your app

### Issue 3: Site Key and Secret Key Mismatch

**Symptom:** Error 400020, CAPTCHA loads but verification fails

**Solution:**
1. Verify both keys are from the **same Turnstile site** in Cloudflare
2. Copy both keys fresh from Cloudflare
3. Update Site Key in Railway
4. Update Secret Key in Supabase Dashboard
5. Wait 1-2 minutes for changes to propagate

### Issue 4: Site Key Disabled or Revoked

**Symptom:** Error 400020, site was working before

**Solution:**
1. Check Cloudflare Turnstile Dashboard
2. Verify the site is **Active** (not disabled)
3. If disabled, re-enable it
4. If revoked, create a new Turnstile site
5. Update both keys in Railway and Supabase

### Issue 5: CSP Blocking Turnstile

**Symptom:** Error 400020, but site key is correct

**Solution:**
1. Check `next.config.mjs` CSP settings
2. Verify these domains are allowed:
   - `https://challenges.cloudflare.com`
   - `https://*.cloudflare.com`
3. Check browser console for CSP violations
4. Update CSP if needed (see `next.config.mjs`)

## Verification Checklist

- [ ] Site key is set in Railway: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] Site key format is valid (starts with `0x4AAAAAAA`)
- [ ] Site key is from an active Turnstile site in Cloudflare
- [ ] Your domain is in the allowed domains list in Cloudflare
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

## Diagnostic Tools

### 1. Diagnostic Endpoint

```bash
# Check configuration
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

## Additional Resources

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile Troubleshooting Guide](./TURNSTILE_TROUBLESHOOTING.md)
- [Fix Invalid Input Secret](./FIX_INVALID_INPUT_SECRET.md)
- [Supabase CAPTCHA Setup](./SUPABASE_CAPTCHA_SETUP.md)

## Quick Fix Summary

1. ✅ Verify site key in Railway matches Cloudflare
2. ✅ Add your domain to allowed domains in Cloudflare
3. ✅ Verify secret key in Supabase matches Cloudflare
4. ✅ Ensure both keys are from the same Turnstile site
5. ✅ Clear cache and test again

