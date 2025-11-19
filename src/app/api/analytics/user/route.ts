import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// GET /api/analytics/user - Get user analytics
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const targetUserId = url.searchParams.get('userId') || userId
    const period = url.searchParams.get('period') || 'all' // all, week, month

    // Only allow users to view their own analytics (or admin can view any)
    if (targetUserId !== userId) {
      // Check if user is admin (optional - implement if needed)
      // For now, only allow viewing own analytics
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Calculate date range
    let dateFilter: Date | null = null
    if (period === 'week') {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (period === 'month') {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    }

    // Get user's posts count
    let postsQuery = supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .is('deleted_at', null)

    if (dateFilter) {
      postsQuery = postsQuery.gte('created_at', dateFilter.toISOString())
    }

    const { count: postsCount } = await postsQuery

    // Get user's post IDs first (for likes/comments queries)
    let userPostsQuery = supabase
      .from('posts')
      .select('id')
      .eq('user_id', targetUserId)
      .is('deleted_at', null)

    if (dateFilter) {
      userPostsQuery = userPostsQuery.gte('created_at', dateFilter.toISOString())
    }

    const { data: userPosts } = await userPostsQuery
    const postIds = (userPosts || []).map((p: any) => p.id)

    // Get likes received on user's posts
    let likesQuery = supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })

    if (postIds.length > 0) {
      likesQuery = likesQuery.in('post_id', postIds)
    } else {
      // No posts, so no likes
      likesQuery = likesQuery.eq('post_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }

    if (dateFilter) {
      likesQuery = likesQuery.gte('created_at', dateFilter.toISOString())
    }

    const { count: likesReceived } = await likesQuery

    // Get comments received on user's posts
    let commentsQuery = supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (postIds.length > 0) {
      commentsQuery = commentsQuery.in('post_id', postIds)
    } else {
      // No posts, so no comments
      commentsQuery = commentsQuery.eq('post_id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
    }

    if (dateFilter) {
      commentsQuery = commentsQuery.gte('created_at', dateFilter.toISOString())
    }

    const { count: commentsReceived } = await commentsQuery

    // Get followers gained (if period filter)
    let followersQuery = supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetUserId)

    if (dateFilter) {
      followersQuery = followersQuery.gte('created_at', dateFilter.toISOString())
    }

    const { count: followersGained } = await followersQuery

    // Get profile stats
    const { data: profile } = await supabase
      .from('profiles')
      .select('posts_count, followers_count, following_count')
      .eq('id', targetUserId)
      .single()

    return NextResponse.json({
      userId: targetUserId,
      period,
      stats: {
        postsCount: postsCount || 0,
        likesReceived: likesReceived || 0,
        commentsReceived: commentsReceived || 0,
        followersGained: followersGained || 0,
        totalFollowers: profile?.followers_count || 0,
        totalFollowing: profile?.following_count || 0,
      },
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[analytics/user] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch user analytics' }, { status: 500 })
  }
}

