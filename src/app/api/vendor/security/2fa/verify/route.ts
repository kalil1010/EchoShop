import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

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

    // Store the 2FA secret in the database
    // In production, you'd:
    // 1. Encrypt the secret before storing
    // 2. Store it in a dedicated secure table (e.g., user_security_settings)
    // 3. Mark 2FA as enabled for the user
    // For now, we store it in event_log payload (not ideal for production, but functional)
    
    // Store the verified secret (in production, encrypt this)
    await supabase.from('event_log').insert({
      event_name: 'vendor_2fa_secret_stored',
      user_id: userId,
      payload: {
        timestamp: new Date().toISOString(),
        secret, // In production, this should be encrypted
        verified: true,
      },
    })

    // Log successful verification and enable 2FA
    await supabase.from('event_log').insert({
      event_name: 'vendor_2fa_enabled',
      user_id: userId,
      payload: { timestamp: new Date().toISOString() },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been enabled for your account.',
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

