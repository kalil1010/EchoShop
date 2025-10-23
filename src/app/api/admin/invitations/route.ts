import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'

export const runtime = 'nodejs'

type InvitationRow = {
  id: string
  invited_email: string
  invited_by: string
  invitation_token: string
  status: string
  created_at: string | null
  expires_at: string | null
  accepted_at: string | null
  inviter?:
    | { display_name: string | null; email: string | null }
    | Array<{ display_name: string | null; email: string | null }>
    | null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const mapInvitation = (row: InvitationRow) => {
  const inviterSource = Array.isArray(row.inviter) ? row.inviter[0] : row.inviter
  return {
    id: row.id,
    invitedEmail: row.invited_email,
    invitedBy: row.invited_by,
    token: row.invitation_token,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    inviter: inviterSource
      ? {
          displayName: inviterSource.display_name,
          email: inviterSource.email,
        }
      : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    await requireRole(supabase, 'admin')

    const url = request.nextUrl
    const statusFilter = url.searchParams.get('status')?.toLowerCase()

    let query = supabase
      .from('admin_invitations')
      .select('id, invited_email, invited_by, invitation_token, status, created_at, expires_at, accepted_at, inviter:profiles!admin_invitations_invited_by_fkey(display_name, email)')
      .order('created_at', { ascending: false })

    if (statusFilter && ['pending', 'accepted', 'expired'].includes(statusFilter)) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query
    if (error) throw error

    const invitations = (data ?? []).map(mapInvitation)
    return NextResponse.json({ invitations })
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
    const supabase = createServiceClient()
    const { profile } = await requireRole(supabase, 'admin')

    if (!profile.isSuperAdmin) {
      throw new PermissionError(
        'forbidden',
        'Only the super admin can send admin invitations.',
      )
    }

    const payload = (await request.json().catch(() => ({}))) as {
      email?: string
      expiresInDays?: number
    }

    const email = payload.email?.trim().toLowerCase()
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const expiresIn = Number.isFinite(payload.expiresInDays)
      ? Math.max(1, Math.min(30, Number(payload.expiresInDays)))
      : 7

    const now = Date.now()
    const expiresAtIso = new Date(now + expiresIn * 24 * 60 * 60 * 1000).toISOString()
    const token = randomUUID()

    const { data: existing, error: existingError } = await supabase
      .from('admin_invitations')
      .select('id, status')
      .eq('invited_email', email)
      .maybeSingle<{ id: string; status: string | null }>()

    if (existingError) throw existingError

    let responseRow: InvitationRow | null = null

    if (!existing) {
      const { data, error } = await supabase
        .from('admin_invitations')
        .insert({
          invited_email: email,
          invited_by: profile.uid,
          invitation_token: token,
          status: 'pending',
          expires_at: expiresAtIso,
        })
        .select(
          'id, invited_email, invited_by, invitation_token, status, created_at, expires_at, accepted_at, inviter:profiles!admin_invitations_invited_by_fkey(display_name, email)',
        )
        .maybeSingle<InvitationRow>()

      if (error) throw error
      responseRow = data
    } else {
      if (existing.status === 'accepted') {
        return NextResponse.json(
          { error: 'This email has already accepted an invitation.' },
          { status: 400 },
        )
      }

      const { data, error } = await supabase
        .from('admin_invitations')
        .update({
          invited_by: profile.uid,
          status: 'pending',
          invitation_token: token,
          expires_at: expiresAtIso,
          accepted_at: null,
        })
        .eq('id', existing.id)
        .select(
          'id, invited_email, invited_by, invitation_token, status, created_at, expires_at, accepted_at, inviter:profiles!admin_invitations_invited_by_fkey(display_name, email)',
        )
        .maybeSingle<InvitationRow>()

      if (error) throw error
      responseRow = data
    }

    if (!responseRow) {
      return NextResponse.json({ error: 'Failed to create invitation.' }, { status: 500 })
    }

    return NextResponse.json({ invitation: mapInvitation(responseRow) }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to create invitation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
