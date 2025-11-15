import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50', 10), 100)

    // Fetch audit logs for user actions
    const { data: events, error } = await supabase
      .from('event_log')
      .select('*')
      .eq('user_id', userId)
      .or('event_name.like.user_%,event_name.like.security_%,event_name.like.auth_%')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    // Map events to audit log entries
    const logs = (events || []).map((event) => {
      const payload = (event.payload as Record<string, unknown>) || {}
      const action = event.event_name.replace(/^user_|^security_|^auth_/, '').replace(/_/g, ' ')
      const status = event.event_name.includes('failed') || event.event_name.includes('error')
        ? 'failure'
        : event.event_name.includes('warning')
          ? 'warning'
          : 'success'

      return {
        id: event.id,
        action: action.charAt(0).toUpperCase() + action.slice(1),
        resource: payload.resource as string || 'Account',
        userId: event.user_id || '',
        timestamp: event.created_at || new Date().toISOString(),
        ipAddress: payload.ipAddress as string,
        userAgent: payload.userAgent as string,
        status,
        details: payload,
      }
    })

    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch audit logs.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

