import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// POST /api/communities/[id]/join - Join community
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Check if already a member
    const { data: existing } = await supabase
      .from('community_members')
      .select('id')
      .eq('community_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Already a member' }, { status: 400 })
    }

    // Join community
    const { error: joinError } = await supabase
      .from('community_members')
      .insert({
        community_id: id,
        user_id: userId,
        role: 'member',
      })

    if (joinError) throw joinError

    return NextResponse.json({ success: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities/join] POST error:', error)
    return NextResponse.json({ error: 'Failed to join community' }, { status: 500 })
  }
}

// DELETE /api/communities/[id]/join - Leave community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    const { error: leaveError } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', id)
      .eq('user_id', userId)

    if (leaveError) throw leaveError

    return NextResponse.json({ success: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities/join] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to leave community' }, { status: 500 })
  }
}

