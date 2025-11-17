import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'
import type { Post } from '@/types/post'

const UpdatePostSchema = z.object({
  caption: z.string().max(2000).optional(),
  privacyLevel: z.enum(['public', 'followers', 'private']).optional(),
  vendorProductIds: z.array(z.string().uuid()).optional(),
})

// GET /api/posts/[id] - Get single post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    const { data: postRow, error: postError } = await supabase
      .from('posts')
      .select(`
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
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (postError) throw postError
    if (!postRow) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check privacy
    if (postRow.privacy_level === 'private' && postRow.user_id !== userId) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (postRow.privacy_level === 'followers' && postRow.user_id !== userId) {
      const { data: isFollowing } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', userId)
        .eq('following_id', postRow.user_id)
        .maybeSingle()

      if (!isFollowing) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
    }

    // Get engagement data
    const [likesResult, commentsResult, userLikeResult, userSaveResult] = await Promise.all([
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', id),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', id).is('deleted_at', null),
      supabase.from('likes').select('id').eq('post_id', id).eq('user_id', userId).maybeSingle(),
      supabase.from('saves').select('id').eq('post_id', id).eq('user_id', userId).maybeSingle(),
    ])

    // Get linked vendor products
    const { data: vendorProducts } = await supabase
      .from('post_vendor_products')
      .select('vendor_product_id')
      .eq('post_id', id)

    const profile = Array.isArray(postRow.profiles) ? postRow.profiles[0] : postRow.profiles

    const post: Post = {
      id: postRow.id,
      userId: postRow.user_id,
      user: profile ? {
        id: profile.id,
        displayName: profile.display_name || undefined,
        photoURL: profile.photo_url || undefined,
      } : undefined,
      caption: postRow.caption || undefined,
      images: (postRow.images || []).map((url: string, idx: number) => ({
        url,
        path: postRow.image_paths?.[idx],
      })),
      outfitData: postRow.outfit_data,
      privacyLevel: postRow.privacy_level as Post['privacyLevel'],
      vendorProductIds: vendorProducts?.map(vp => vp.vendor_product_id),
      engagement: {
        likesCount: likesResult.count || 0,
        commentsCount: commentsResult.count || 0,
        userLiked: !!userLikeResult.data,
        userSaved: !!userSaveResult.data,
      },
      createdAt: new Date(postRow.created_at),
      updatedAt: new Date(postRow.updated_at),
    }

    return NextResponse.json({ post })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// PATCH /api/posts/[id] - Update post
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: postRow } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!postRow || postRow.user_id !== userId) {
      return NextResponse.json({ error: 'Post not found or unauthorized' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = UpdatePostSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { caption, privacyLevel, vendorProductIds } = parsed.data

    // Update post
    const updateData: any = {}
    if (caption !== undefined) updateData.caption = caption || null
    if (privacyLevel !== undefined) updateData.privacy_level = privacyLevel

    const { data: updatedPost, error: updateError } = await supabase
      .from('posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Update vendor product links if provided
    if (vendorProductIds !== undefined) {
      // Delete existing links
      await supabase
        .from('post_vendor_products')
        .delete()
        .eq('post_id', id)

      // Insert new links
      if (vendorProductIds.length > 0) {
        const productLinks = vendorProductIds.map((productId, index) => ({
          post_id: id,
          vendor_product_id: productId,
          position: index,
        }))

        await supabase
          .from('post_vendor_products')
          .insert(productLinks)
      }
    }

    return NextResponse.json({ post: updatedPost })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

// DELETE /api/posts/[id] - Soft delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: postRow } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!postRow || postRow.user_id !== userId) {
      return NextResponse.json({ error: 'Post not found or unauthorized' }, { status: 404 })
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}

