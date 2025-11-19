import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const UpdateCommunitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
  isPublic: z.boolean().optional(),
})

// GET /api/communities/[id] - Get community
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const { id } = await params
    const supabase = createServiceClient()

    const { data: community, error } = await supabase
      .from('communities')
      .select(`
        id,
        name,
        description,
        cover_image,
        created_by,
        is_public,
        member_count,
        post_count,
        created_at,
        updated_at,
        profiles:created_by (
          id,
          display_name,
          photo_url
        )
      `)
      .eq('id', id)
      .single()

    if (error || !community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 })
    }

    // Check if user is member
    let isMember = false
    if (userId) {
      const { data: member } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', id)
        .eq('user_id', userId)
        .maybeSingle()
      isMember = !!member
    }

    return NextResponse.json({
      community: {
        id: community.id,
        name: community.name,
        description: community.description,
        coverImage: community.cover_image,
        createdBy: community.created_by,
        creator: community.profiles ? {
          id: community.profiles.id,
          displayName: community.profiles.display_name,
          photoURL: community.profiles.photo_url,
        } : null,
        isPublic: community.is_public,
        memberCount: community.member_count,
        postCount: community.post_count,
        isMember,
        createdAt: community.created_at,
        updatedAt: community.updated_at,
      },
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch community' }, { status: 500 })
  }
}

// PATCH /api/communities/[id] - Update community
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!community || community.created_by !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = UpdateCommunitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null
    if (parsed.data.coverImage !== undefined) updateData.cover_image = parsed.data.coverImage || null
    if (parsed.data.isPublic !== undefined) updateData.is_public = parsed.data.isPublic

    const { data: updatedCommunity, error: updateError } = await supabase
      .from('communities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ community: updatedCommunity })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities] PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update community' }, { status: 500 })
  }
}

// DELETE /api/communities/[id] - Delete community
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const { id } = await params
    const supabase = createServiceClient()

    // Verify ownership
    const { data: community } = await supabase
      .from('communities')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!community || community.created_by !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('communities')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete community' }, { status: 500 })
  }
}

