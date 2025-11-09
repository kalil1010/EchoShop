# CAPTCHA (Cloudflare Turnstile) Implementation

## Overview
This document describes the CAPTCHA integration using Cloudflare Turnstile for the sign-up flow to prevent bot abuse.

## Implementation Details

### 1. Package Installation
- **Package**: `@marsidev/react-turnstile`
- **Version**: Latest (installed via npm)

### 2. Environment Variables
- **Required**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Location**: Set in Vercel environment variables or `.env.local` for local development
- **Note**: The Turnstile widget will only render if this environment variable is set

### 3. Component Updates

#### SignUpForm.tsx
- Added Turnstile widget component
- Added CAPTCHA token state management
- Added token validation before form submission
- Added error handling for CAPTCHA failures
- Added CAPTCHA reset on submission errors
- Button is disabled until CAPTCHA is completed

#### AuthContext.tsx
- Updated `signUp` function signature to accept `captchaToken?: string`
- Added CAPTCHA token validation
- Included `captchaToken` in `supabase.auth.signUp()` options

### 4. Flow

1. User fills out sign-up form
2. Turnstile widget appears (if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set)
3. User completes CAPTCHA verification
4. Token is captured and stored in component state
5. On form submission:
   - Token is validated (must be present)
   - Token is passed to `signUp()` function
   - Token is included in Supabase auth request
6. On error:
   - CAPTCHA is reset to allow retry
   - User can complete CAPTCHA again

### 5. Error Handling

- **Missing Token**: Form submission is blocked with error message
- **CAPTCHA Error**: Widget displays error, user can retry
- **Token Expiry**: Widget automatically resets on expiry
- **Supabase Error**: CAPTCHA is reset to allow new attempt

### 6. Configuration

#### Supabase Configuration
Ensure Supabase is configured with:
- CAPTCHA protection enabled in Auth settings
- Cloudflare Turnstile selected as provider
- Turnstile Secret Key configured in Supabase dashboard

#### Cloudflare Turnstile Setup
1. Get Site Key and Secret Key from Cloudflare dashboard
2. Add Site Key to environment variable: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
3. Add Secret Key to Supabase Auth settings

### 7. Testing

#### Local Development
1. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in `.env.local`
2. Use Cloudflare's test keys for development:
   - Site Key: `1x00000000000000000000AA` (always passes)
   - Site Key: `2x00000000000000000000AB` (always blocks)
   - Site Key: `3x00000000000000000000FF` (forces interactive challenge)

#### Production
1. Ensure production Turnstile Site Key is set in Vercel
2. Verify Supabase has the matching Secret Key
3. Test sign-up flow end-to-end

### 8. Troubleshooting

#### CAPTCHA widget not appearing
- Check that `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set
- Verify environment variable is accessible in browser (check `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`)

#### "CAPTCHA verification failed" error
- Verify Turnstile Secret Key is correctly set in Supabase
- Check that Site Key and Secret Key match (from same Turnstile site)
- Verify Supabase CAPTCHA protection is enabled
- Check browser console for Turnstile errors

#### Token not being sent
- Verify `captchaToken` is being captured in `handleCaptchaSuccess`
- Check that token is passed to `signUp()` function
- Verify `signUp()` includes token in Supabase request

### 9. Files Modified

- `src/components/auth/SignUpForm.tsx` - Added Turnstile widget and token handling
- `src/contexts/AuthContext.tsx` - Updated signUp to accept and use CAPTCHA token
- `vercel.json` - Added environment variable configuration
- `package.json` - Added `@marsidev/react-turnstile` dependency

### 10. Next Steps

1. **Set Environment Variable**: Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to your deployment environment
2. **Configure Supabase**: Ensure Turnstile Secret Key is set in Supabase Auth settings
3. **Test**: Verify sign-up flow works with CAPTCHA
4. **Monitor**: Check for any CAPTCHA-related errors in production logs

## References

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Supabase CAPTCHA Documentation](https://supabase.com/docs/guides/auth/auth-captcha)
- [@marsidev/react-turnstile Package](https://www.npmjs.com/package/@marsidev/react-turnstile)

