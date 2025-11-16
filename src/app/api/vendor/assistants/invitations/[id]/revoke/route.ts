import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: invitationId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Verify invitation belongs to vendor
    const { data: invitation } = await supabase
      .from('vendor_assistant_invitations')
      .select('id, status')
      .eq('id', invitationId)
      .eq('vendor_id', userId)
      .maybeSingle()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invitations can be revoked.' },
        { status: 400 },
      )
    }

    // Revoke invitation
    const { error: updateError } = await supabase
      .from('vendor_assistant_invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: userId,
      })
      .eq('id', invitationId)
      .eq('vendor_id', userId)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ message: 'Invitation revoked successfully.' })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to revoke invitation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

