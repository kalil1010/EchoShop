import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const CreateCommunitySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coverImage: z.string().url().optional(),
  isPublic: z.boolean().default(true),
})

// GET /api/communities - List communities
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Get public communities
    const { data: communities, error } = await supabase
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
        profiles:created_by (
          id,
          display_name,
          photo_url
        )
      `)
      .eq('is_public', true)
      .order('member_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      communities: (communities || []).map((c: any) => {
        const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          coverImage: c.cover_image,
          createdBy: c.created_by,
          creator: profile ? {
            id: profile.id,
            displayName: profile.display_name,
            photoURL: profile.photo_url,
          } : null,
          isPublic: c.is_public,
          memberCount: c.member_count,
          postCount: c.post_count,
          createdAt: c.created_at,
        }
      }),
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 })
  }
}

// POST /api/communities - Create community
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = CreateCommunitySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, coverImage, isPublic } = parsed.data

    const { data: community, error: communityError } = await supabase
      .from('communities')
      .insert({
        name,
        description: description || null,
        cover_image: coverImage || null,
        created_by: userId,
        is_public: isPublic,
      })
      .select()
      .single()

    if (communityError) throw communityError

    // Auto-join creator as admin
    await supabase
      .from('community_members')
      .insert({
        community_id: community.id,
        user_id: userId,
        role: 'admin',
      })

    return NextResponse.json({ community }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[communities] POST error:', error)
    return NextResponse.json({ error: 'Failed to create community' }, { status: 500 })
  }
}

