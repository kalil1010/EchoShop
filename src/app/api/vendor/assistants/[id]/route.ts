import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

const VALID_ROLES = ['viewer', 'editor', 'manager']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assistantId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const payload = await request.json().catch(() => ({}))
    const role = typeof payload.role === 'string' ? payload.role : null

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be viewer, editor, or manager.' },
        { status: 400 },
      )
    }

    // Verify assistant belongs to vendor
    const { data: assistant } = await supabase
      .from('vendor_assistants')
      .select('id')
      .eq('id', assistantId)
      .eq('vendor_id', userId)
      .is('removed_at', null)
      .maybeSingle()

    if (!assistant) {
      return NextResponse.json({ error: 'Assistant not found.' }, { status: 404 })
    }

    // Update role
    const { error: updateError } = await supabase
      .from('vendor_assistants')
      .update({ assistant_role: role })
      .eq('id', assistantId)
      .eq('vendor_id', userId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ message: 'Assistant role updated successfully.' })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update assistant.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: assistantId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Verify assistant belongs to vendor
    const { data: assistant } = await supabase
      .from('vendor_assistants')
      .select('id')
      .eq('id', assistantId)
      .eq('vendor_id', userId)
      .is('removed_at', null)
      .maybeSingle()

    if (!assistant) {
      return NextResponse.json({ error: 'Assistant not found.' }, { status: 404 })
    }

    // Soft delete (mark as removed)
    const { error: updateError } = await supabase
      .from('vendor_assistants')
      .update({
        removed_at: new Date().toISOString(),
        removed_by: userId,
      })
      .eq('id', assistantId)
      .eq('vendor_id', userId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ message: 'Assistant removed successfully.' })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to remove assistant.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

