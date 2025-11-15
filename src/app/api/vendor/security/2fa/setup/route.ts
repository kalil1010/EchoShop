import { NextRequest, NextResponse } from 'next/server'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Get user email for the account name
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle<{ email: string | null }>()

    const accountName = profile?.email || userId
    const serviceName = 'Echo Shop'

    // Generate a secret for the user
    const secret = authenticator.generateSecret()

    // Generate OTP Auth URL
    const otpAuthUrl = authenticator.keyuri(accountName, serviceName, secret)

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpAuthUrl)

    // Store the secret temporarily in event_log for verification
    // In production, you'd store this encrypted in a dedicated table
    // For now, we store it in the event_log payload so it can be retrieved during verification

    // Log the 2FA setup initiation and store the secret temporarily
    // Note: In production, store the secret encrypted in a dedicated table
    await supabase.from('event_log').insert({
      event_name: 'vendor_2fa_setup_initiated',
      user_id: userId,
      payload: {
        timestamp: new Date().toISOString(),
        secret, // Temporarily stored here for verification step
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // Expires in 10 minutes
      },
    })

    return NextResponse.json({
      secret,
      qrCode,
      message: '2FA setup initialized. Scan the QR code with your authenticator app.',
    })
  } catch (error) {
    console.error('Failed to setup 2FA:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to setup 2FA.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

