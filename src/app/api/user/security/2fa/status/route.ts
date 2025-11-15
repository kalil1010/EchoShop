import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Check if 2FA is enabled in user_security_settings table
    const { data: settings, error: settingsError } = await supabase
      .from('user_security_settings')
      .select('two_factor_enabled, two_factor_enabled_at')
      .eq('user_id', userId)
      .maybeSingle<{ two_factor_enabled: boolean; two_factor_enabled_at: string | null }>()

    if (settingsError) {
      console.warn('Failed to check 2FA status:', settingsError)
      return NextResponse.json({
        enabled: false,
      })
    }

    return NextResponse.json({
      enabled: settings?.two_factor_enabled ?? false,
      enabledAt: settings?.two_factor_enabled_at || null,
    })
  } catch (error) {
    console.error('Failed to check 2FA status:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to check 2FA status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

