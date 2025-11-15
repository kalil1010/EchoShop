import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Disable 2FA in user_security_settings
    const { error: updateError } = await supabase
      .from('user_security_settings')
      .update({
        two_factor_enabled: false,
        two_factor_secret_encrypted: null,
        two_factor_backup_codes: null,
        failed_2fa_attempts: 0,
        locked_until: null,
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to disable 2FA:', updateError)
      // Continue anyway - log the event
    }

    // Log 2FA disable
    await supabase.from('event_log').insert({
      event_name: 'admin_2fa_disabled',
      user_id: userId,
      payload: { timestamp: new Date().toISOString() },
    })

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been disabled for your account.',
    })
  } catch (error) {
    console.error('Failed to disable 2FA:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to disable 2FA.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

