import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { decrypt } from '@/lib/security/encryption'
import { verify2FASession, get2FASession } from '@/lib/security/twoFactorAuth'

export const runtime = 'nodejs'

/**
 * Verify 2FA code for login or critical actions
 * This endpoint is used for both login 2FA and critical action 2FA
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const payload = await request.json().catch(() => ({}))
    const code = typeof payload.code === 'string' ? payload.code.trim() : null
    const sessionToken = typeof payload.sessionToken === 'string' ? payload.sessionToken : null
    const backupCode = typeof payload.backupCode === 'string' ? payload.backupCode.trim() : null

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required.' }, { status: 400 })
    }

    // Get the 2FA session
    const session = await get2FASession(sessionToken)
    if (!session) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 400 })
    }

    if (session.userId !== userId) {
      return NextResponse.json({ error: 'Session does not match user.' }, { status: 403 })
    }

    if (session.verified) {
      return NextResponse.json({ error: 'Session already verified.' }, { status: 400 })
    }

    // Get user's 2FA secret
    const { data: settings, error: settingsError } = await supabase
      .from('user_security_settings')
      .select('two_factor_secret_encrypted, two_factor_backup_codes, failed_2fa_attempts, locked_until')
      .eq('user_id', userId)
      .maybeSingle<{
        two_factor_secret_encrypted: string | null
        two_factor_backup_codes: string[] | null
        failed_2fa_attempts: number
        locked_until: string | null
      }>()

    if (settingsError || !settings?.two_factor_secret_encrypted) {
      return NextResponse.json({ error: '2FA is not enabled for this account.' }, { status: 400 })
    }

    // Check if account is locked
    if (settings.locked_until && new Date(settings.locked_until) > new Date()) {
      return NextResponse.json(
        {
          error: 'Account is temporarily locked due to too many failed attempts. Please try again later.',
        },
        { status: 423 },
      )
    }

    let isValid = false

    // Try backup code first if provided
    if (backupCode && settings.two_factor_backup_codes) {
      try {
        for (const encryptedBackupCode of settings.two_factor_backup_codes) {
          const decryptedCode = decrypt(encryptedBackupCode)
          if (decryptedCode === backupCode) {
            isValid = true
            // Remove used backup code
            const updatedBackupCodes = settings.two_factor_backup_codes.filter(
              (code) => code !== encryptedBackupCode,
            )
            await supabase
              .from('user_security_settings')
              .update({ two_factor_backup_codes: updatedBackupCodes })
              .eq('user_id', userId)
            break
          }
        }
      } catch (error) {
        console.error('Backup code verification error:', error)
      }
    }

    // Try TOTP code if backup code didn't work
    if (!isValid && code) {
      try {
        const secret = decrypt(settings.two_factor_secret_encrypted)
        isValid = authenticator.check(code, secret)
      } catch (error) {
        console.error('TOTP verification error:', error)
      }
    }

    if (!isValid) {
      // Increment failed attempts
      const newFailedAttempts = (settings.failed_2fa_attempts || 0) + 1
      const updateData: {
        failed_2fa_attempts: number
        locked_until?: string
      } = {
        failed_2fa_attempts: newFailedAttempts,
      }

      // Lock account after 5 failed attempts for 30 minutes
      if (newFailedAttempts >= 5) {
        updateData.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }

      await supabase.from('user_security_settings').update(updateData).eq('user_id', userId)

      // Log failed attempt
      await supabase.from('event_log').insert({
        event_name: '2fa_verification_failed',
        user_id: userId,
        payload: {
          timestamp: new Date().toISOString(),
          purpose: session.purpose,
          action_type: session.actionType,
          failed_attempts: newFailedAttempts,
        },
      })

      return NextResponse.json(
        {
          error: 'Invalid verification code. Please try again.',
          remainingAttempts: Math.max(0, 5 - newFailedAttempts),
        },
        { status: 400 },
      )
    }

    // Reset failed attempts on success
    await supabase
      .from('user_security_settings')
      .update({
        failed_2fa_attempts: 0,
        locked_until: null,
        two_factor_last_used: new Date().toISOString(),
      })
      .eq('user_id', userId)

    // Verify the session
    const verified = await verify2FASession(sessionToken)
    if (!verified) {
      return NextResponse.json({ error: 'Failed to verify session.' }, { status: 500 })
    }

    // Log successful verification
    await supabase.from('event_log').insert({
      event_name: '2fa_verification_success',
      user_id: userId,
      payload: {
        timestamp: new Date().toISOString(),
        purpose: session.purpose,
        action_type: session.actionType,
      },
    })

    return NextResponse.json({
      success: true,
      message: '2FA verification successful.',
      sessionToken: session.sessionToken,
      purpose: session.purpose,
      actionType: session.actionType,
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

