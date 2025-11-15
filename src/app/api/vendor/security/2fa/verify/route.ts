import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

// TODO: Install required package: npm install otplib
// import { authenticator } from 'otplib'

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

    // Verify the code (placeholder - requires otplib)
    // Note: In production, you'd retrieve the secret from the database instead of accepting it from the client
    // const isValid = authenticator.check(code, secret)
    // For now, accept any 6-digit code as valid (REMOVE IN PRODUCTION)
    const isValid = /^\d{6}$/.test(code)

    if (!isValid) {
      // Log failed verification attempt
      await supabase.from('event_log').insert({
        event_name: 'vendor_2fa_verification_failed',
        user_id: userId,
        payload: { timestamp: new Date().toISOString(), reason: 'invalid_code' },
      })

      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 400 })
    }

    // TODO: Store the 2FA secret in the database (encrypted)
    // For now, we'll just mark 2FA as enabled in a user preferences table
    // In production, you'd:
    // 1. Encrypt the secret
    // 2. Store it in a secure table (e.g., user_security_settings)
    // 3. Mark 2FA as enabled for the user

    // Log successful verification
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

