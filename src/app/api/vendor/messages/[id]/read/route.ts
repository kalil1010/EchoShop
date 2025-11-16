import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

/**
 * PATCH /api/vendor/messages/[id]/read
 * Mark a message as read
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

    // Verify message exists and user is recipient
    const { data: message, error: fetchError } = await supabase
      .from('vendor_owner_messages')
      .select('*')
      .eq('id', id)
      .eq('recipient_id', userId)
      .maybeSingle()

    if (fetchError || !message) {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
    }

    // Mark as read
    const { data: updated, error: updateError } = await supabase
      .from('vendor_owner_messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('recipient_id', userId)
      .select('*')
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true, message: updated })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to mark message as read.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

