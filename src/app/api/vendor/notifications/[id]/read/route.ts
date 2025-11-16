import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

/**
 * PATCH /api/vendor/notifications/[id]/read
 * Mark a notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const { id } = await params
    const supabase = createServiceClient()

    // Verify notification exists and belongs to user
    const { data: notification, error: fetchError } = await supabase
      .from('vendor_notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError || !notification) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 })
    }

    // Mark as read
    const { data: updated, error: updateError } = await supabase
      .from('vendor_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, notification: updated })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to mark notification as read.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

