# Supabase Auth Hooks Email Service - Quick Start

## Quick Setup Checklist

### 1. Railway Environment Variables
- [ ] Set `ZOHO_EMAIL_FROM` (e.g., `noreply@yourdomain.com`)
- [ ] Set `ZOHO_EMAIL_USER` (your Zoho email address)
- [ ] Set `ZOHO_EMAIL_PASSWORD` (Zoho app-specific password)
- [ ] Set `SUPABASE_AUTH_HOOK_SECRET` (generate with `openssl rand -hex 32`)
- [ ] (Optional) Set `NEXT_PUBLIC_APP_URL` (your app domain)

### 2. Supabase Auth Hooks Configuration
- [ ] Navigate to Supabase Dashboard → Authentication → Auth Hooks (BETA)
- [ ] Enable Auth Hooks feature
- [ ] Create hook for `user_confirmation_requested` → `https://[your-app].railway.app/api/auth-hooks/send-confirmation`
- [ ] Create hook for `user_password_reset_requested` → `https://[your-app].railway.app/api/auth-hooks/send-password-reset`
- [ ] Create hook for `user_magic_link_requested` → `https://[your-app].railway.app/api/auth-hooks/send-magic-link`
- [ ] Set webhook secret (same as `SUPABASE_AUTH_HOOK_SECRET` in Railway)
- [ ] Enable retry policy with exponential backoff

### 3. Verify Setup
- [ ] Check health endpoint: `curl https://[your-app].railway.app/api/auth-hooks/health`
- [ ] Test sign-up flow and verify email received
- [ ] Check Railway logs for any errors

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth-hooks/health` | GET | Health check and configuration status |
| `/api/auth-hooks/send-confirmation` | POST | Handle sign-up confirmation emails |
| `/api/auth-hooks/send-password-reset` | POST | Handle password reset emails |
| `/api/auth-hooks/send-magic-link` | POST | Handle magic link emails |
| `/api/auth-hooks/debug` | POST | Debug endpoint (logs payloads) |

## Troubleshooting

### Health Check Fails
1. Verify all environment variables are set in Railway
2. Check Zoho Mail credentials are correct
3. Verify SMTP connection in health endpoint response

### Emails Not Sending
1. Check Railway logs for error messages
2. Verify webhook is configured correctly in Supabase
3. Test SMTP connection with health endpoint
4. Check Zoho Mail account status and app password

### Invalid Signature Error
1. Verify `SUPABASE_AUTH_HOOK_SECRET` matches in both places
2. Check for extra whitespace in environment variable
3. Verify webhook secret in Supabase matches Railway secret

### Email in Spam Folder
1. Verify SPF/DKIM records for your domain
2. Ensure `ZOHO_EMAIL_FROM` matches verified domain
3. Check Zoho Mail domain verification status

## Testing

### Test Sign-Up Flow
1. Create a test user account
2. Check Railway logs for webhook received
3. Verify email is sent (check inbox and spam)
4. Click confirmation link and verify it works

### Test Password Reset
1. Request password reset
2. Check Railway logs for webhook received
3. Verify email is sent with reset link
4. Click reset link and verify it works

## Support

For detailed setup instructions, see [SUPABASE_AUTH_HOOKS_EMAIL_SETUP.md](./SUPABASE_AUTH_HOOKS_EMAIL_SETUP.md)

For environment variables documentation, see [RAILWAY_ENV_VARIABLES.md](./RAILWAY_ENV_VARIABLES.md)

