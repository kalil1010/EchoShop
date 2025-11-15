import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { encrypt, generateBackupCodes } from '@/lib/security/encryption'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const payload = await request.json().catch(() => ({}))
    const code = typeof payload.code === 'string' ? payload.code.trim() : null
    const secret = typeof payload.secret === 'string' ? payload.secret : null

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid verification code.' }, { status: 400 })
    }

    if (!secret) {
      return NextResponse.json({ error: 'Secret is required for verification.' }, { status: 400 })
    }

    // Verify the code using TOTP
    // Note: In production, you'd retrieve the secret from the database instead of accepting it from the client
    let isValid = false
    try {
      isValid = authenticator.check(code, secret)
    } catch (error) {
      console.error('TOTP verification error:', error)
      return NextResponse.json({ error: 'Invalid verification code format.' }, { status: 400 })
    }

    if (!isValid) {
      // Log failed verification attempt
      await supabase.from('event_log').insert({
        event_name: 'vendor_2fa_verification_failed',
        user_id: userId,
        payload: { timestamp: new Date().toISOString(), reason: 'invalid_code' },
      })

      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 })
    }

    // Encrypt and store the 2FA secret in user_security_settings table
    const encryptedSecret = encrypt(secret)
    const backupCodes = generateBackupCodes(8)
    const encryptedBackupCodes = backupCodes.map((code) => encrypt(code))

    // Upsert security settings
    const { error: settingsError } = await supabase
      .from('user_security_settings')
      .upsert(
        {
          user_id: userId,
          two_factor_enabled: true,
          two_factor_secret_encrypted: encryptedSecret,
          two_factor_backup_codes: encryptedBackupCodes,
          two_factor_enabled_at: new Date().toISOString(),
          failed_2fa_attempts: 0,
        },
        { onConflict: 'user_id' },
      )

    if (settingsError) {
      console.error('Failed to store 2FA settings:', settingsError)
      throw new Error('Failed to save 2FA settings')
    }

    // Log successful verification and enable 2FA
    await supabase.from('event_log').insert({
      event_name: 'vendor_2fa_enabled',
      user_id: userId,
      payload: { timestamp: new Date().toISOString() },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled for your account.',
      backupCodes, // Return backup codes to user (they should save these)
    })
  } catch (error) {
    console.error('Failed to verify 2FA:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to verify 2FA code.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

