import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// GET /api/analytics/post/[id] - Get post analytics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify post exists and user owns it
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('user_id, created_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get likes count
    const { count: likesCount } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)

    // Get comments count
    const { count: commentsCount } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .is('deleted_at', null)

    // Get views count from event_log (if tracked)
    const { count: viewsCount } = await supabase
      .from('event_log')
      .select('id', { count: 'exact', head: true })
      .eq('event_name', 'post_view')
      .eq('payload->>post_id', id)

    // Calculate engagement rate (likes + comments / views, or just engagement if no views)
    const totalEngagement = (likesCount || 0) + (commentsCount || 0)
    const engagementRate = viewsCount && viewsCount > 0
      ? ((totalEngagement / viewsCount) * 100).toFixed(2)
      : null

    // Get saves count
    const { count: savesCount } = await supabase
      .from('saves')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)

    // Get reach (unique users who saw the post - approximated by views)
    const reach = viewsCount || 0

    // Get time-based stats (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: recentLikes } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .gte('created_at', sevenDaysAgo.toISOString())

    const { count: recentComments } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', id)
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo.toISOString())

    return NextResponse.json({
      postId: id,
      analytics: {
        views: viewsCount || 0,
        likes: likesCount || 0,
        comments: commentsCount || 0,
        saves: savesCount || 0,
        totalEngagement,
        engagementRate: engagementRate ? parseFloat(engagementRate) : null,
        reach,
        recentEngagement: {
          likes: recentLikes || 0,
          comments: recentComments || 0,
          period: '7days',
        },
        createdAt: post.created_at,
      },
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[analytics/post] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch post analytics' }, { status: 500 })
  }
}

