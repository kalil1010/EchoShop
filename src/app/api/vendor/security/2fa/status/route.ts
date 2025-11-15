import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // TODO: Check if 2FA is enabled in the database
    // For now, we'll check the event_log for a successful 2FA enable event
    const { data: events } = await supabase
      .from('event_log')
      .select('event_name, created_at')
      .eq('user_id', userId)
      .eq('event_name', 'vendor_2fa_enabled')
      .order('created_at', { ascending: false })
      .limit(1)

    // Check if there's a disable event after the enable event
    const { data: disableEvents } = await supabase
      .from('event_log')
      .select('event_name, created_at')
      .eq('user_id', userId)
      .eq('event_name', 'vendor_2fa_disabled')
      .order('created_at', { ascending: false })
      .limit(1)

    const enabled = events && events.length > 0
    const disabledAfter = disableEvents && disableEvents.length > 0 && events && events.length > 0
      ? new Date(disableEvents[0].created_at) > new Date(events[0].created_at)
      : false

    return NextResponse.json({
      enabled: enabled && !disabledAfter,
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

