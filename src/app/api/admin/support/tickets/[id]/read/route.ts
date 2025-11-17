import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { normaliseRole } from '@/lib/roles'

export const runtime = 'nodejs'

/**
 * PATCH /api/admin/support/tickets/[id]/read
 * Mark a message as read (for owner/admin)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify user is owner or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) {
      throw profileError
    }

    const role = normaliseRole(profile?.role)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Owner or admin access required.' }, { status: 403 })
    }

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

