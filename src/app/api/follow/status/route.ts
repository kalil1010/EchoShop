import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// GET /api/follow/status - Check follow status between users
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const followingId = url.searchParams.get('followingId')

    if (!followingId) {
      return NextResponse.json({ error: 'Missing followingId parameter' }, { status: 400 })
    }

    if (followingId === userId) {
      return NextResponse.json({ following: false, isSelf: true })
    }

    // Check if following
    const { data: follow, error: followError } = await supabase
      .from('follows')
      .select('created_at')
      .eq('follower_id', userId)
      .eq('following_id', followingId)
      .maybeSingle()

    if (followError) throw followError

    return NextResponse.json({
      following: !!follow,
      followedAt: follow?.created_at || null,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[follow/status] GET error:', error)
    return NextResponse.json({ error: 'Failed to check follow status' }, { status: 500 })
  }
}

