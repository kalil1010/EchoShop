import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// POST /api/posts/[id]/like - Like a post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingLike) {
      return NextResponse.json({ liked: true })
    }

    // Create like
    const { error: likeError } = await supabase
      .from('likes')
      .insert({
        post_id: id,
        user_id: userId,
      })

    if (likeError) throw likeError

    return NextResponse.json({ liked: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts/like] error:', error)
    return NextResponse.json({ error: 'Failed to like post' }, { status: 500 })
  }
}

// DELETE /api/posts/[id]/like - Unlike a post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    const { error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', id)
      .eq('user_id', userId)

    if (deleteError) throw deleteError

    return NextResponse.json({ liked: false })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[posts/unlike] error:', error)
    return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 })
  }
}

