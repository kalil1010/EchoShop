# Railway Environment Variables Configuration

## Turnstile CAPTCHA Variables

### Required in Railway:
- ✅ **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`** - The public site key from Cloudflare Turnstile
  - This is used client-side to render the CAPTCHA widget
  - Must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser
  - Get this from: [Cloudflare Turnstile Dashboard](https://developers.cloudflare.com/turnstile/)

### NOT Required in Railway:
- ❌ **`TURNSTILE_SECRET_KEY`** - Do NOT set this in Railway
- ❌ **`NEXT_PUBLIC_TURNSTILE_SECRET_KEY`** - NEVER expose the secret key to the client (security risk)

### Where to Set the Secret Key:
The Turnstile Secret Key should be configured in **Supabase Dashboard**, not in Railway:

1. Go to Supabase Dashboard → Authentication → Settings → CAPTCHA Protection
2. Select **Cloudflare Turnstile** as the provider
3. Paste the **Secret Key** in the "Turnstile Secret Key" field
4. Save the settings

## Why This Setup?

1. **Site Key (Public)**: Safe to expose to the browser, used to render the CAPTCHA widget
2. **Secret Key (Private)**: Must remain server-side only, used by Supabase to verify CAPTCHA tokens
3. **Security**: Never expose secret keys to the client - they would allow anyone to bypass CAPTCHA verification

## Verification

After setting up:
1. ✅ `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set in Railway
2. ✅ Turnstile Secret Key is configured in Supabase Dashboard
3. ✅ Both keys are from the same Turnstile site (they must match)
4. ✅ Cloudflare Turnstile is selected as the provider in Supabase

## Complete Railway Environment Variables List

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Turnstile CAPTCHA (Public Site Key Only)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key

# Other variables...
# (Add your other environment variables here)
```

**Note**: The Turnstile Secret Key is configured in Supabase Dashboard, not in Railway.

