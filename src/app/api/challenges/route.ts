import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

const CreateChallengeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  coverImage: z.string().url().optional(),
  communityId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

// GET /api/challenges - List active challenges
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request).catch(() => ({ userId: null }))
    const supabase = createServiceClient()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const { data: challenges, error } = await supabase
      .from('challenges')
      .select(`
        id,
        title,
        description,
        cover_image,
        community_id,
        created_by,
        start_date,
        end_date,
        is_active,
        submission_count,
        created_at,
        profiles:created_by (
          id,
          display_name,
          photo_url
        )
      `)
      .eq('is_active', true)
      .gte('end_date', new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      challenges: (challenges || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        coverImage: c.cover_image,
        communityId: c.community_id,
        createdBy: c.created_by,
        creator: c.profiles ? {
          id: c.profiles.id,
          displayName: c.profiles.display_name,
          photoURL: c.profiles.photo_url,
        } : null,
        startDate: c.start_date,
        endDate: c.end_date,
        isActive: c.is_active,
        submissionCount: c.submission_count,
        createdAt: c.created_at,
      })),
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[challenges] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}

// POST /api/challenges - Create challenge
export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const body = await request.json()
    const parsed = CreateChallengeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { title, description, coverImage, communityId, startDate, endDate } = parsed.data

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 })
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .insert({
        title,
        description: description || null,
        cover_image: coverImage || null,
        community_id: communityId || null,
        created_by: userId,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
      })
      .select()
      .single()

    if (challengeError) throw challengeError

    return NextResponse.json({ challenge }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      return NextResponse.json({ error: mapped.message }, { status: 401 })
    }
    console.error('[challenges] POST error:', error)
    return NextResponse.json({ error: 'Failed to create challenge' }, { status: 500 })
  }
}

