import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

/**
 * PATCH /api/vendor/notifications/read-all
 * Mark all notifications as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Mark all as read using the function
    const { data: count, error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: userId,
    })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      markedRead: count as number,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to mark notifications as read.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

