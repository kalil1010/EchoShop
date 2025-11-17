import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'
import type { Post } from '@/types/post'

// GET /api/hashtags/[tag] - Get posts with a specific hashtag
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const { tag } = await params
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get hashtag
    const { data: hashtag, error: hashtagError } = await supabase
      .from('hashtags')
      .select('id, name, post_count')
      .eq('name', tag.toLowerCase())
      .single()

    if (hashtagError || !hashtag) {
      return NextResponse.json({ posts: [], hashtag: null })
    }

    // Get posts with this hashtag
    const { data: postHashtags, error: postHashtagsError } = await supabase
      .from('post_hashtags')
      .select(`
        post_id,
        posts:post_id (
          id,
          user_id,
          caption,
          images,
          image_paths,
          outfit_data,
          privacy_level,
          created_at,
          updated_at,
          deleted_at,
          profiles:user_id (
            id,
            display_name,
            photo_url
          )
        )
      `)
      .eq('hashtag_id', hashtag.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postHashtagsError) throw postHashtagsError

    // Filter out deleted posts and apply privacy
    const posts: Post[] = []
    for (const row of (postHashtags || [])) {
      const postData = (row as any).posts
      if (!postData || postData.deleted_at) continue

      // Check privacy
      if (postData.privacy_level === 'private' && postData.user_id !== userId) continue
      if (postData.privacy_level === 'followers' && postData.user_id !== userId) {
        if (userId) {
          const { data: isFollowing } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', userId)
            .eq('following_id', postData.user_id)
            .maybeSingle()
          if (!isFollowing) continue
        } else {
          continue
        }
      }

      // Get engagement
      const [likesResult, commentsResult, userLikeResult] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', postData.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postData.id).is('deleted_at', null),
        userId ? supabase.from('likes').select('id').eq('post_id', postData.id).eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
      ])

      const profile = Array.isArray(postData.profiles) ? postData.profiles[0] : postData.profiles

      posts.push({
        id: postData.id,
        userId: postData.user_id,
        user: profile ? {
          id: profile.id,
          displayName: profile.display_name || undefined,
          photoURL: profile.photo_url || undefined,
        } : undefined,
        caption: postData.caption || undefined,
        images: (postData.images || []).map((url: string, idx: number) => ({
          url,
          path: postData.image_paths?.[idx],
        })),
        outfitData: postData.outfit_data,
        privacyLevel: postData.privacy_level,
        engagement: {
          likesCount: likesResult.count || 0,
          commentsCount: commentsResult.count || 0,
          userLiked: !!userLikeResult.data,
          userSaved: false,
        },
        createdAt: new Date(postData.created_at),
        updatedAt: new Date(postData.updated_at),
      })
    }

    return NextResponse.json({
      posts,
      hashtag: {
        name: hashtag.name,
        postCount: hashtag.post_count,
      },
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[hashtags] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch hashtag posts' }, { status: 500 })
  }
}

