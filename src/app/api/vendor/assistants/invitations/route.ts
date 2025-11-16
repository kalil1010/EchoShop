import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'

export const runtime = 'nodejs'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface InvitationRow {
  id: string
  vendor_id: string
  invited_email: string
  invited_by: string
  assistant_role: string
  invitation_token: string
  status: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    const { data: invitations, error } = await supabase
      .from('vendor_assistant_invitations')
      .select('*')
      .eq('vendor_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const mapped = (invitations as InvitationRow[] || []).map((inv) => ({
      id: inv.id,
      invitedEmail: inv.invited_email,
      assistantRole: inv.assistant_role,
      status: inv.status,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      acceptedAt: inv.accepted_at || undefined,
    }))

    return NextResponse.json({ invitations: mapped })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load invitations.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const payload = await request.json().catch(() => ({}))
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : null
    const role = typeof payload.role === 'string' ? payload.role : 'viewer'

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const validRoles = ['viewer', 'editor', 'manager']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be viewer, editor, or manager.' }, { status: 400 })
    }

    // Check if user is already an assistant
    const { data: existingAssistant } = await supabase
      .from('vendor_assistants')
      .select('id')
      .eq('vendor_id', userId)
      .eq('assistant_id', userId) // This will be checked after they accept
      .maybeSingle()

    // Check for existing pending invitation
    const { data: existingInvitation } = await supabase
      .from('vendor_assistant_invitations')
      .select('id, status')
      .eq('vendor_id', userId)
      .eq('invited_email', email)
      .maybeSingle<{ id: string; status: string }>()

    if (existingInvitation && existingInvitation.status === 'pending') {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email address.' },
        { status: 400 },
      )
    }

    // Create invitation
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days

    const { data: invitation, error: insertError } = await supabase
      .from('vendor_assistant_invitations')
      .insert({
        vendor_id: userId,
        invited_email: email,
        invited_by: userId,
        assistant_role: role,
        invitation_token: token,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single<InvitationRow>()

    if (insertError) {
      throw insertError
    }

    // TODO: Send invitation email here
    // For now, we'll just return the invitation

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          invitedEmail: invitation.invited_email,
          assistantRole: invitation.assistant_role,
          status: invitation.status,
          createdAt: invitation.created_at,
          expiresAt: invitation.expires_at,
        },
        message: 'Invitation sent successfully.',
      },
      { status: 201 },
    )
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to send invitation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

