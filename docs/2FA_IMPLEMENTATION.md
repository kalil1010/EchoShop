# Two-Factor Authentication (2FA) Implementation

## Overview

This document describes the complete 2FA implementation for Echo Shop, including:
- Encrypted secret storage in Supabase
- 2FA requirements for owners (login + critical actions)
- 2FA requirements for users and vendors (critical actions only)
- Integration with login flows and critical action routes

## Database Schema

### Tables Created

1. **`user_security_settings`** - Stores encrypted 2FA secrets and settings
   - `user_id` (uuid, unique) - References auth.users
   - `two_factor_enabled` (boolean) - Whether 2FA is enabled
   - `two_factor_secret_encrypted` (text) - Encrypted TOTP secret
   - `two_factor_backup_codes` (text[]) - Encrypted backup codes
   - `two_factor_enabled_at` (timestamptz) - When 2FA was enabled
   - `two_factor_last_used` (timestamptz) - Last successful verification
   - `failed_2fa_attempts` (integer) - Failed verification attempts
   - `locked_until` (timestamptz) - Account lockout expiration

2. **`two_factor_sessions`** - Temporary verification sessions
   - `id` (uuid) - Primary key
   - `user_id` (uuid) - References auth.users
   - `session_token` (uuid, unique) - Session identifier
   - `purpose` (text) - 'login' or 'critical_action'
   - `action_type` (text) - Type of critical action (e.g., 'delete_product')
   - `action_context` (jsonb) - Additional context
   - `verified` (boolean) - Whether session is verified
   - `expires_at` (timestamptz) - Session expiration (10 minutes)

### Migration File

- `docs/supabase/20250127_user_security_settings.sql`

## Encryption

### Implementation

- **File**: `src/lib/security/encryption.ts`
- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Key Source**: `ENCRYPTION_KEY` environment variable (falls back to `SUPABASE_SERVICE_ROLE_KEY`)

### Functions

- `encrypt(plaintext: string): string` - Encrypts sensitive data
- `decrypt(encryptedData: string): string` - Decrypts sensitive data
- `generateBackupCodes(count?: number): string[]` - Generates 8-digit backup codes

## 2FA Utilities

### File: `src/lib/security/twoFactorAuth.ts`

#### Functions

- `is2FAEnabled(userId: string): Promise<boolean>` - Checks if user has 2FA enabled
- `is2FARequired(userRole, purpose, actionType?): boolean` - Determines if 2FA is required
  - **Owner/Admin**: Required for all logins AND critical actions
  - **Vendor**: Required for critical actions only
  - **User**: Required for critical actions only
- `create2FASession(userId, purpose, actionType?, actionContext?): Promise<TwoFactorSession | null>` - Creates verification session
- `verify2FASession(sessionToken: string): Promise<boolean>` - Marks session as verified
- `get2FASession(sessionToken: string): Promise<TwoFactorSession | null>` - Retrieves session
- `cleanupExpiredSessions(): Promise<void>` - Removes expired sessions

### Critical Action Types

- `delete_product` - Delete a product
- `delete_account` - Delete user account
- `change_role` - Change user role
- `payout_request` - Request payout
- `bulk_delete` - Bulk delete operations
- `modify_pricing` - Modify pricing
- `export_data` - Export user data
- `admin_action` - Admin-specific actions

## API Routes

### 2FA Setup & Management

1. **`POST /api/vendor/security/2fa/setup`** - Initialize 2FA setup
   - Generates TOTP secret and QR code
   - Stores secret temporarily in `event_log` for verification step

2. **`POST /api/vendor/security/2fa/verify`** - Verify and enable 2FA
   - Verifies TOTP code
   - Encrypts and stores secret in `user_security_settings`
   - Generates and stores backup codes

3. **`GET /api/vendor/security/2fa/status`** - Check 2FA status
   - Returns whether 2FA is enabled and when it was enabled

4. **`POST /api/vendor/security/2fa/disable`** - Disable 2FA
   - Removes encrypted secret and backup codes
   - Logs disable event

### 2FA Verification

5. **`POST /api/auth/2fa/require`** - Check if 2FA is required
   - Checks user role and action type
   - Creates verification session if required
   - Returns session token

6. **`POST /api/auth/2fa/verify`** - Verify 2FA code
   - Accepts TOTP code or backup code
   - Verifies against encrypted secret
   - Marks session as verified
   - Tracks failed attempts and locks account after 5 failures

## Server-Side Utilities

### File: `src/lib/server/require2FA.ts`

- `require2FAForAction(request, actionType, actionContext?): Promise<Require2FAResult>` - Checks if 2FA is required and verified for a critical action
- `create2FARequiredResponse(result): NextResponse` - Creates error response for missing 2FA

## UI Components

### TwoFactorVerificationModal

**File**: `src/components/auth/TwoFactorVerificationModal.tsx`

Modal component for 2FA verification with:
- 6-digit TOTP code input
- 8-digit backup code option
- Error handling and retry logic
- Loading states

### Integration Points

1. **Owner Login** (`src/components/owner/OwnerLoginForm.tsx`)
   - Checks 2FA requirement after successful email/password login
   - Shows verification modal if 2FA is required and enabled
   - Blocks login if 2FA is required but not enabled

2. **Product Deletion** (`src/components/vendor/EnhancedProductManagement.tsx`)
   - Checks 2FA requirement before deleting product
   - Shows verification modal if required
   - Sends session token in request header after verification

3. **API Route Protection** (`src/app/api/vendor/products/[id]/route.ts`)
   - DELETE endpoint checks for 2FA verification
   - Returns 403 with `requires2FA: true` if verification missing

## Security Features

### Account Lockout

- After 5 failed 2FA attempts, account is locked for 30 minutes
- Lockout stored in `user_security_settings.locked_until`
- Failed attempts reset on successful verification

### Backup Codes

- 8 backup codes generated when 2FA is enabled
- Codes are encrypted before storage
- Used codes are removed from the database
- Codes can be used if authenticator app is unavailable

### Session Management

- Verification sessions expire after 10 minutes
- Sessions are single-use (verified flag prevents reuse)
- Sessions are tied to specific user and action

## Usage Examples

### Enabling 2FA (Vendor)

1. Navigate to Security Settings in vendor dashboard
2. Click "Enable 2FA"
3. Scan QR code with authenticator app
4. Enter 6-digit code to verify
5. Save backup codes securely

### Owner Login with 2FA

1. Enter email and password
2. If 2FA is enabled, verification modal appears
3. Enter 6-digit code from authenticator app
4. Login completes after successful verification

### Critical Action with 2FA

1. User attempts critical action (e.g., delete product)
2. System checks if 2FA is required
3. If required, verification modal appears
4. User enters 6-digit code
5. Action proceeds after successful verification

## Environment Variables

```bash
# Required for encryption (use a strong, randomly generated key)
ENCRYPTION_KEY=your-strong-encryption-key-here

# Optional: Falls back to this if ENCRYPTION_KEY not set
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Future Enhancements

1. **Dedicated Secret Storage**: Move from `event_log` temporary storage to dedicated encrypted table
2. **SMS 2FA**: Add SMS-based 2FA as alternative to TOTP
3. **Recovery Email**: Email-based recovery for lost authenticator
4. **Hardware Keys**: Support for FIDO2/WebAuthn hardware keys
5. **2FA Reminder**: Periodic reminders for users without 2FA enabled
6. **Session Persistence**: Remember device for 30 days option

## Testing Checklist

- [ ] Owner can enable 2FA
- [ ] Owner login requires 2FA after enabling
- [ ] Owner can use backup code for login
- [ ] Account locks after 5 failed attempts
- [ ] Vendor can enable 2FA
- [ ] Vendor product deletion requires 2FA
- [ ] User critical actions require 2FA
- [ ] 2FA sessions expire after 10 minutes
- [ ] Encrypted secrets cannot be decrypted without key
- [ ] Backup codes are single-use

## Migration Instructions

1. Run the Supabase migration:
   ```sql
   \i docs/supabase/20250127_user_security_settings.sql
   ```

2. Set environment variable:
   ```bash
   ENCRYPTION_KEY=$(openssl rand -base64 32)
   ```

3. Restart the application

4. Test 2FA setup and verification flows

