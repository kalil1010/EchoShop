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

## Email Service Variables (Supabase Auth Hooks)

### Required in Railway:
- ✅ **`ZOHO_EMAIL_FROM`** - The email address to send emails from (e.g., `noreply@yourdomain.com`)
  - Must be a verified email address in your Zoho Mail account
  - Should match your domain for better deliverability

- ✅ **`ZOHO_EMAIL_USER`** - Your Zoho Mail email address (e.g., `your-email@yourdomain.com`)
  - Used for SMTP authentication
  - Must match the Zoho Mail account with SMTP access enabled

- ✅ **`ZOHO_EMAIL_PASSWORD`** - App-specific password for Zoho Mail
  - **IMPORTANT**: Use an app-specific password, not your regular Zoho password
  - Generate from Zoho Account Security Settings → App Passwords
  - Required if 2FA is enabled on your Zoho account

- ✅ **`SUPABASE_AUTH_HOOK_SECRET`** - Secret key for webhook signature verification
  - Generate a secure random string (32+ characters recommended)
  - Must match the webhook secret configured in Supabase Auth Hooks
  - Use: `openssl rand -hex 32` to generate
  - **NEVER expose this to the client** - server-side only

### Optional in Railway:
- ⚠️ **`NEXT_PUBLIC_APP_URL`** - Your application's base URL (optional)
  - Used in email templates for links
  - Defaults to Supabase URL if not set
  - Example: `https://your-app-domain.com`

### Where to Configure:
1. **Zoho Mail**: Configure SMTP settings in Zoho Mail account
2. **Supabase Auth Hooks**: Configure webhooks in Supabase Dashboard → Authentication → Auth Hooks (BETA)
3. **Railway**: Set all environment variables in Railway project settings

See [SUPABASE_AUTH_HOOKS_EMAIL_SETUP.md](./SUPABASE_AUTH_HOOKS_EMAIL_SETUP.md) for detailed setup instructions.

## Complete Railway Environment Variables List

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Turnstile CAPTCHA (Public Site Key Only)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key

# Email Service (Zoho Mail + Supabase Auth Hooks)
ZOHO_EMAIL_FROM=noreply@yourdomain.com
ZOHO_EMAIL_USER=your-email@yourdomain.com
ZOHO_EMAIL_PASSWORD=your-app-specific-password
SUPABASE_AUTH_HOOK_SECRET=your-secure-random-secret-key
NEXT_PUBLIC_APP_URL=https://your-app-domain.com

# Other variables...
# (Add your other environment variables here)
```

**Notes**:
- The Turnstile Secret Key is configured in Supabase Dashboard, not in Railway.
- Zoho Mail App-Specific Password must be generated from Zoho Account Security Settings.
- SUPABASE_AUTH_HOOK_SECRET must match the webhook secret in Supabase Auth Hooks configuration.

