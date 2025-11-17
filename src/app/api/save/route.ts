import { NextRequest, NextResponse } from 'next/server'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

// POST /api/save - Save a post
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const postId = body.postId
    const collectionId = body.collectionId || null
    const collectionName = body.collectionName || null

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ error: 'Invalid postId' }, { status: 400 })
    }

    // Check if already saved
    const { data: existingSave } = await supabase
      .from('saves')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .eq('collection_id', collectionId || null)
      .maybeSingle()

    if (existingSave) {
      return NextResponse.json({ saved: true })
    }

    // Create save
    const { error: saveError } = await supabase
      .from('saves')
      .insert({
        user_id: userId,
        post_id: postId,
        collection_id: collectionId,
        collection_name: collectionName,
      })

    if (saveError) throw saveError

    return NextResponse.json({ saved: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[save] POST error:', error)
    return NextResponse.json({ error: 'Failed to save post' }, { status: 500 })
  }
}

// DELETE /api/save - Unsave a post
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const postId = url.searchParams.get('postId')
    const collectionId = url.searchParams.get('collectionId')

    if (!postId) {
      return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
    }

    let query = supabase
      .from('saves')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId)

    if (collectionId) {
      query = query.eq('collection_id', collectionId)
    }

    const { error: deleteError } = await query

    if (deleteError) throw deleteError

    return NextResponse.json({ saved: false })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[save] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unsave post' }, { status: 500 })
  }
}

