# How to Fix "invalid-input-secret" Turnstile Error

## Error Message
```
captcha protection: request disallowed (invalid-input-secret)
```

## What This Means
The Turnstile Secret Key in Supabase Dashboard is either:
- ❌ Not set
- ❌ Incorrect
- ❌ Doesn't match your Site Key (from different Turnstile site)
- ❌ Has extra spaces or characters

## Step-by-Step Fix

### Step 1: Get Your Turnstile Keys from Cloudflare

1. Go to [Cloudflare Turnstile Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Click on your site (or create a new one)
3. Copy both keys:
   - **Site Key** (public) - starts with something like `0x4AAA...`
   - **Secret Key** (private) - starts with something like `0x4AAA...` (different from site key)

### Step 2: Verify Site Key in Railway

1. Go to Railway Dashboard → Your Project → Variables
2. Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
3. Verify it matches the **Site Key** from Cloudflare (not the Secret Key)
4. Make sure there are no extra spaces before/after the key

### Step 3: Configure Secret Key in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to: **Authentication** → **Settings** → **CAPTCHA Protection**
4. Ensure **CAPTCHA protection is enabled** (toggle should be ON)
5. Select **Cloudflare Turnstile** as the provider
6. In the **"Turnstile Secret Key"** field:
   - Paste the **Secret Key** from Cloudflare (NOT the Site Key)
   - Make sure there are no extra spaces
   - The key should start with `0x4AAA...`
7. Click **Save**

### Step 4: Verify Keys Match

**Critical**: The Site Key and Secret Key must be from the **same Turnstile site** in Cloudflare.

1. In Cloudflare Turnstile Dashboard, verify both keys are from the same site
2. If you're not sure, create a new Turnstile site and use both keys from that site:
   - Copy the new Site Key → Update `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Railway
   - Copy the new Secret Key → Update in Supabase Dashboard

### Step 5: Test the Fix

1. After updating the Secret Key in Supabase, wait 1-2 minutes for changes to propagate
2. Clear your browser cache or use incognito mode
3. Try logging in again
4. Complete the CAPTCHA
5. Submit the login form
6. The error should be resolved

## Quick Checklist

- [ ] Turnstile Site Key is set in Railway: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- [ ] Turnstile Secret Key is set in Supabase Dashboard (Authentication → Settings → CAPTCHA Protection)
- [ ] Both keys are from the same Turnstile site in Cloudflare
- [ ] CAPTCHA protection is enabled in Supabase
- [ ] Cloudflare Turnstile is selected as the provider in Supabase
- [ ] No extra spaces in either key
- [ ] Waited 1-2 minutes after updating Supabase settings
- [ ] Cleared browser cache or using incognito mode

## Common Mistakes

1. **Using Site Key instead of Secret Key in Supabase**
   - ❌ Wrong: Pasted Site Key in Supabase Secret Key field
   - ✅ Correct: Pasted Secret Key in Supabase Secret Key field

2. **Keys from Different Sites**
   - ❌ Wrong: Site Key from Site A, Secret Key from Site B
   - ✅ Correct: Both keys from the same site

3. **Extra Spaces**
   - ❌ Wrong: ` 0x4AAA... ` (spaces before/after)
   - ✅ Correct: `0x4AAA...` (no spaces)

4. **CAPTCHA Protection Not Enabled**
   - ❌ Wrong: CAPTCHA protection is disabled in Supabase
   - ✅ Correct: CAPTCHA protection is enabled

## Still Having Issues?

1. **Double-check the keys match:**
   - Go to Cloudflare Turnstile Dashboard
   - Verify both keys are from the same site
   - Copy them fresh (don't use cached copies)

2. **Create a new Turnstile site:**
   - Create a new site in Cloudflare Turnstile
   - Get new Site Key and Secret Key
   - Update both Railway and Supabase with the new keys

3. **Verify Supabase settings:**
   - Go to Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
   - Make sure the provider is "Cloudflare Turnstile" (not reCAPTCHA)
   - Make sure CAPTCHA protection is enabled
   - Verify the Secret Key field has the correct value

4. **Check Railway variables:**
   - Go to Railway Dashboard → Your Project → Variables
   - Verify `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set correctly
   - Make sure there are no typos

5. **Wait for propagation:**
   - Supabase settings can take 1-2 minutes to propagate
   - Railway environment variables require a redeploy to take effect
   - After making changes, wait a few minutes before testing

## Need Help?

If you've followed all steps and still get the error:
1. Verify both keys in Cloudflare Turnstile Dashboard
2. Take screenshots of your Supabase CAPTCHA settings (hide the secret key)
3. Check Railway environment variables
4. Review the error message in browser console for more details

