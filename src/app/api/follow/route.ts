import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// POST /api/follow - Follow a user
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const followingId = body.followingId

    if (!followingId || typeof followingId !== 'string') {
      return NextResponse.json({ error: 'Invalid followingId' }, { status: 400 })
    }

    if (followingId === userId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', followingId)
      .maybeSingle()

    if (existingFollow) {
      return NextResponse.json({ following: true })
    }

    // Create follow
    const { error: followError } = await supabase
      .from('follows')
      .insert({
        follower_id: userId,
        following_id: followingId,
      })

    if (followError) throw followError

    return NextResponse.json({ following: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[follow] POST error:', error)
    return NextResponse.json({ error: 'Failed to follow user' }, { status: 500 })
  }
}

// DELETE /api/follow - Unfollow a user
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const followingId = url.searchParams.get('followingId')

    if (!followingId) {
      return NextResponse.json({ error: 'Missing followingId' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', followingId)

    if (deleteError) throw deleteError

    return NextResponse.json({ following: false })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[follow] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unfollow user' }, { status: 500 })
  }
}

