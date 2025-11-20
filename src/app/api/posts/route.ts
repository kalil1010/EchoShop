import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'
import type { Post, PostRow } from '@/types/post'

const CreatePostSchema = z.object({
  caption: z.string().max(2000).optional(),
  images: z.array(z.string()).min(1).max(10), // Array of image URLs (uploaded separately)
  imagePaths: z.array(z.string()).min(1).max(10),
  privacyLevel: z.enum(['public', 'followers', 'private']).default('public'),
  vendorProductIds: z.array(z.string().uuid()).optional(),
})

// GET /api/posts - Fetch feed
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()
    
    const url = new URL(request.url)
    const feedType = url.searchParams.get('type') || 'following' // following, discover, trending
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Try to fetch posts with profiles join, but handle gracefully if it fails
    let query = supabase
      .from('posts')
      .select(`
        id,
        user_id,
        caption,
        images,
        image_paths,
        privacy_level,
        created_at,
        updated_at,
        deleted_at,
        profiles:user_id (
          id,
          display_name,
          photo_url
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply feed type filter
    if (feedType === 'following') {
      // Get posts from users the current user follows
      const { data: following, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)

      if (followsError) {
        console.error('[posts] Error fetching follows:', followsError)
        // If follows table doesn't exist or has issues, fall back to own posts only
        query = query.eq('user_id', userId)
      } else {
        const followingIds = following?.map(f => f.following_id) || []
        if (followingIds.length > 0) {
          query = query.in('user_id', [...followingIds, userId]) // Include own posts
        } else {
          // If not following anyone, show only own posts
          query = query.eq('user_id', userId)
        }
      }
    } else if (feedType === 'trending') {
      // For trending, we'll use a simple engagement-based query
      // In production, use the get_trending_posts function
      query = query.eq('privacy_level', 'public')
    } else {
      // Discover feed - show public posts
      query = query.eq('privacy_level', 'public')
    }

    const { data, error } = await query

    if (error) {
      console.error('[posts] Error fetching posts query:', error)
      
      // Check if it's a "table doesn't exist" error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = (error as { code?: string })?.code
      
      // If posts table doesn't exist, return empty array instead of error
      if (
        errorCode === '42P01' || // PostgreSQL: relation does not exist
        errorMessage.includes('relation') && errorMessage.includes('does not exist') ||
        errorMessage.includes('table') && errorMessage.includes('does not exist') ||
        errorMessage.includes('relation "public.posts" does not exist')
      ) {
        console.warn('[posts] Posts table does not exist. Returning empty feed.')
        return NextResponse.json({ posts: [] })
      }
      
      throw error
    }

    // Get engagement data for each post
    const postsWithEngagement = await Promise.all(
      (data || []).map(async (row: any) => {
        try {
          const [likesResult, commentsResult, userLikeResult] = await Promise.all([
            supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', row.id),
            supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', row.id).is('deleted_at', null),
            supabase.from('likes').select('id').eq('post_id', row.id).eq('user_id', userId).maybeSingle(),
          ])

          // Handle errors gracefully - if tables don't exist, use defaults
          const likesCount = likesResult.error ? 0 : (likesResult.count || 0)
          const commentsCount = commentsResult.error ? 0 : (commentsResult.count || 0)
          const userLiked = userLikeResult.error ? false : !!userLikeResult.data

          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

          return {
            id: row.id,
            userId: row.user_id,
            user: profile ? {
              id: profile.id,
              displayName: profile.display_name,
              photoURL: profile.photo_url,
            } : undefined,
            caption: row.caption,
            images: (row.images || []).map((url: string, idx: number) => ({
              url,
              path: row.image_paths?.[idx],
            })),
            privacyLevel: row.privacy_level,
            engagement: {
              likesCount,
              commentsCount,
              userLiked,
              userSaved: false, // Will be checked separately if needed
            },
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          } as Post
        } catch (engagementError) {
          console.error(`[posts] Error fetching engagement for post ${row.id}:`, engagementError)
          // Return post with zero engagement if engagement fetch fails
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
          return {
            id: row.id,
            userId: row.user_id,
            user: profile ? {
              id: profile.id,
              displayName: profile.display_name,
              photoURL: profile.photo_url,
            } : undefined,
            caption: row.caption,
            images: (row.images || []).map((url: string, idx: number) => ({
              url,
              path: row.image_paths?.[idx],
            })),
            privacyLevel: row.privacy_level,
            engagement: {
              likesCount: 0,
              commentsCount: 0,
              userLiked: false,
              userSaved: false,
            },
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          } as Post
        }
      })
    )

    return NextResponse.json({ posts: postsWithEngagement })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string })?.code
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { error: String(error) }
    
    console.error('[posts] GET error:', {
      message: errorMessage,
      code: errorCode,
      details: errorDetails,
      error,
    })
    
    // Check if it's a "table doesn't exist" error - return empty array
    if (
      errorCode === '42P01' || // PostgreSQL: relation does not exist
      errorMessage.includes('relation') && errorMessage.includes('does not exist') ||
      errorMessage.includes('table') && errorMessage.includes('does not exist') ||
      errorMessage.includes('relation "public.posts" does not exist') ||
      errorMessage.includes('relation "public.follows" does not exist')
    ) {
      console.warn('[posts] Database tables do not exist. Returning empty feed.')
      return NextResponse.json({ posts: [] })
    }
    
    // Return more informative error message in development
    const isDevelopment = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      { 
        error: 'Failed to fetch posts',
        ...(isDevelopment && { details: errorMessage })
      },
      { status: 500 }
    )
  }
}

// POST /api/posts - Create new post
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = CreatePostSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { caption, images, imagePaths, privacyLevel, vendorProductIds } = parsed.data

    // Create post
    const { data: postData, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        caption: caption || null,
        images,
        image_paths: imagePaths,
        privacy_level: privacyLevel,
      })
      .select()
      .single()

    if (postError) throw postError

    // Link vendor products if provided
    if (vendorProductIds && vendorProductIds.length > 0) {
      const productLinks = vendorProductIds.map((productId, index) => ({
        post_id: postData.id,
        vendor_product_id: productId,
        position: index,
      }))

      const { error: linkError } = await supabase
        .from('post_vendor_products')
        .insert(productLinks)

      if (linkError) {
        console.warn('[posts] Failed to link vendor products:', linkError)
        // Don't fail the post creation if product linking fails
      }
    }

    // Get user profile for response
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name, photo_url')
      .eq('id', userId)
      .single()

    const post: Post = {
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
      privacyLevel: postData.privacy_level as Post['privacyLevel'],
      engagement: {
        likesCount: 0,
        commentsCount: 0,
        userLiked: false,
        userSaved: false,
      },
      createdAt: new Date(postData.created_at),
      updatedAt: new Date(postData.updated_at),
    }

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts] POST error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}

