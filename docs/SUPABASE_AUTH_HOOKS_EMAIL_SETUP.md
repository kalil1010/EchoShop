# Supabase Auth Hooks Email Setup Guide

## Overview

This guide explains how to set up custom email delivery for Supabase Auth using Auth Hooks (BETA) and Zoho Mail SMTP via a Railway backend service.

## Problem

Supabase's default email service was failing with error `553 Sender is not allowed to relay emails`, preventing sign-up confirmation emails from being sent.

## Solution

We've implemented a custom email service that:
- Intercepts Supabase Auth email events via Auth Hooks
- Sends emails through Zoho Mail SMTP using Nodemailer
- Maintains email security and reliability
- Provides logging and monitoring
- Supports production-grade email delivery

## Architecture

```
User Sign-Up 
  → Supabase Auth API (/signup endpoint)
    → GoTrue Auth Service
      → Supabase Auth Hook triggered (user_confirmation_requested)
        → HTTP POST to Railway Backend
          → Email Service (Nodemailer)
            → Zoho Mail SMTP Server
              → Email delivered ✅
                → Webhook response sent back to Supabase
```

## Setup Instructions

### 1. Railway Environment Variables

Add the following environment variables to your Railway project:

```bash
# Zoho Mail SMTP Configuration
ZOHO_EMAIL_FROM=noreply@yourdomain.com
ZOHO_EMAIL_USER=your-zoho-email@yourdomain.com
ZOHO_EMAIL_PASSWORD=your-zoho-app-password

# Supabase Auth Hook Secret
SUPABASE_AUTH_HOOK_SECRET=your-secure-random-secret-key

# Application Base URL (optional, defaults to Supabase URL)
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

#### Zoho Mail Setup

1. **Create a Zoho Mail account** (if you don't have one)
2. **Generate an App-Specific Password**:
   - Go to Zoho Account Security Settings
   - Enable 2-Factor Authentication (if not already enabled)
   - Generate an App-Specific Password for "Mail"
   - Use this password (not your regular password) for `ZOHO_EMAIL_PASSWORD`

3. **Configure SMTP Settings**:
   - Host: `smtp.zoho.com`
   - Port: `465`
   - Security: SSL/TLS
   - Username: Your Zoho email address
   - Password: App-specific password

#### Webhook Secret

Generate a secure random secret key for webhook signature verification:

```bash
# Generate a secure random secret (32+ characters recommended)
openssl rand -hex 32
```

Store this value in `SUPABASE_AUTH_HOOK_SECRET` in Railway.

### 2. Supabase Auth Hooks Configuration

1. **Navigate to Supabase Dashboard**:
   - Go to your project: https://supabase.com/dashboard/project/[your-project-id]
   - Navigate to **Authentication** → **Auth Hooks (BETA)**

2. **Enable Auth Hooks** (if not already enabled)

3. **Create Hook for User Confirmation**:
   - **Event Type**: `user_confirmation_requested`
   - **Webhook URL**: `https://[your-railway-app].railway.app/api/auth-hooks/send-confirmation`
   - **HTTP Method**: `POST`
   - **Retry Policy**: Enable with exponential backoff
   - **Webhook Secret**: Use the same secret you set in `SUPABASE_AUTH_HOOK_SECRET`

4. **Create Hook for Password Reset**:
   - **Event Type**: `user_password_reset_requested`
   - **Webhook URL**: `https://[your-railway-app].railway.app/api/auth-hooks/send-password-reset`
   - **HTTP Method**: `POST`
   - **Retry Policy**: Enable with exponential backoff
   - **Webhook Secret**: Same as above

5. **Create Hook for Magic Link** (optional):
   - **Event Type**: `user_magic_link_requested`
   - **Webhook URL**: `https://[your-railway-app].railway.app/api/auth-hooks/send-magic-link`
   - **HTTP Method**: `POST`
   - **Retry Policy**: Enable with exponential backoff
   - **Webhook Secret**: Same as above

### 3. Disable Supabase Default Email Service

1. **Navigate to Supabase Dashboard**:
   - Go to **Authentication** → **Settings** → **Email Templates**
   - **Disable** "Enable email confirmations" (temporarily) OR
   - Keep it enabled but the hooks will override the default email sending

   **Note**: Supabase Auth Hooks intercept the email sending, so the default SMTP configuration won't be used even if enabled.

### 4. Verify Setup

1. **Check Health Endpoint**:
   ```bash
   curl https://[your-railway-app].railway.app/api/auth-hooks/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "services": {
       "smtp": {
         "connected": true,
         "host": "smtp.zoho.com",
         "port": 465
       },
       "webhook": {
         "secretConfigured": true
       }
     },
     "environment": {
       "variablesConfigured": true,
       "missingVariables": []
     }
   }
   ```

2. **Test Sign-Up Flow**:
   - Create a test user account
   - Check Railway logs for email send attempts
   - Verify email is received in inbox
   - Check spam folder if not in inbox

## API Endpoints

### Health Check
- **Endpoint**: `GET /api/auth-hooks/health`
- **Purpose**: Check email service health and configuration
- **Authentication**: None required

### Send Confirmation Email
- **Endpoint**: `POST /api/auth-hooks/send-confirmation`
- **Purpose**: Handle user confirmation email requests
- **Authentication**: Webhook signature verification
- **Event**: `user_confirmation_requested`

### Send Password Reset Email
- **Endpoint**: `POST /api/auth-hooks/send-password-reset`
- **Purpose**: Handle password reset email requests
- **Authentication**: Webhook signature verification
- **Event**: `user_password_reset_requested`

### Send Magic Link Email
- **Endpoint**: `POST /api/auth-hooks/send-magic-link`
- **Purpose**: Handle magic link email requests
- **Authentication**: Webhook signature verification
- **Event**: `user_magic_link_requested`

## Security Considerations

### Webhook Signature Verification

All webhook requests are verified using HMAC-SHA256 signature:
- Supabase signs the request body with the webhook secret
- Our backend verifies the signature before processing
- Invalid signatures are rejected with 401 status

### Environment Variables

- Never commit secrets to version control
- Use Railway's environment variable management
- Rotate secrets periodically
- Use app-specific passwords for Zoho Mail (not regular passwords)

### Data Protection

- User email addresses are handled securely
- Confirmation tokens are single-use and time-limited (Supabase-managed)
- No sensitive user data is logged
- SMTP credentials stored securely in Railway environment variables

## Troubleshooting

### Email Not Sending

1. **Check Railway Logs**:
   ```bash
   # View logs in Railway dashboard
   # Look for [email-service] or [auth-hooks] entries
   ```

2. **Verify SMTP Connection**:
   ```bash
   curl https://[your-railway-app].railway.app/api/auth-hooks/health
   ```

3. **Check Zoho Mail Settings**:
   - Verify app-specific password is correct
   - Ensure 2FA is enabled on Zoho account
   - Check Zoho Mail account status

4. **Verify Webhook Configuration**:
   - Check Supabase Auth Hooks are enabled
   - Verify webhook URLs are correct
   - Ensure webhook secret matches in both places

### Invalid Signature Error

- Verify `SUPABASE_AUTH_HOOK_SECRET` matches the secret in Supabase Dashboard
- Check that the secret is not truncated or modified
- Ensure no extra whitespace in environment variable

### SMTP Connection Failed

- Verify Zoho Mail credentials are correct
- Check if Zoho Mail account has SMTP access enabled
- Verify firewall/network restrictions
- Check Zoho Mail service status

### Email in Spam Folder

- Verify SPF records for your domain
- Check DKIM settings in Zoho Mail
- Ensure `ZOHO_EMAIL_FROM` matches your verified domain
- Consider setting up DMARC records

## Monitoring

### Logging

All email send attempts are logged with:
- Timestamp
- User ID and email
- Email type (confirmation, reset, magic link)
- Success/failure status
- Error messages (if failed)
- Duration of operation

### Log Locations

- Railway logs: Available in Railway dashboard
- Console logs: Prefix with `[email-service]` or `[auth-hooks]`

### Metrics to Monitor

- Email send success rate
- Average email send duration
- SMTP connection failures
- Webhook signature verification failures
- Retry attempts

## Email Templates

Email templates are located in `src/lib/email/templates.ts` and include:
- **Confirmation Email**: Welcome message with confirmation link
- **Password Reset Email**: Password reset instructions
- **Magic Link Email**: Passwordless sign-in link

Templates are:
- Responsive (mobile-friendly)
- Branded with Echo Shop styling
- Include fallback text links
- Have expiration warnings

## Retry Logic

The email service implements automatic retry with exponential backoff:
- **Max Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Backoff Multiplier**: 2x
- **Retry Delays**: 1s, 2s, 4s

## Support

For issues or questions:
1. Check Railway logs for error messages
2. Verify environment variables are set correctly
3. Test health endpoint for configuration issues
4. Review Supabase Auth Hooks documentation
5. Check Zoho Mail SMTP documentation

## Additional Resources

- [Supabase Auth Hooks Documentation](https://supabase.com/docs/guides/auth/auth-hooks)
- [Zoho Mail SMTP Settings](https://www.zoho.com/mail/help/zoho-mail-smtp-configuration.html)
- [Nodemailer Documentation](https://nodemailer.com/about/)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)

