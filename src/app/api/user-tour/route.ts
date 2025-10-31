import { NextRequest, NextResponse } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceClient, getAuthenticatedUserId } from '@/lib/supabaseServer'
import type { UserTourStateRow } from '@/types/userTour'

/**
 * public.user_tour_state schema
 * - id uuid primary key default gen_random_uuid()
 * - user_id uuid not null references auth.users(id)
 * - tour_slug text not null
 * - status text not null check(status in ('not_started','in_progress','completed'))
 * - metadata jsonb
 * - created_at timestamptz default timezone('utc', now())
 * - updated_at timestamptz default timezone('utc', now())
 */

const StatusSchema = z.enum(['not_started', 'in_progress', 'completed'])

const BodySchema = z.object({
  slug: z.string().min(1),
  status: StatusSchema,
  metadata: z.record(z.any()).optional(),
})

type TourStatus = z.infer<typeof StatusSchema>

function responseOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) {
    return NextResponse.json({ ok: false, error: 'Missing slug' }, { status: 400 })
  }

  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return responseOk({ slug, status: 'not_started' as TourStatus })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('user_tour_state')
      .select('id, status, updated_at, metadata, created_at')
      .eq('user_id', userId)
      .eq('tour_slug', slug)
      .maybeSingle()

    if (error || !data) {
      return responseOk({ slug, status: 'not_started' as TourStatus })
    }

    return responseOk({
      slug,
      status: data.status as TourStatus,
      updated_at: data.updated_at,
      created_at: data.created_at,
      metadata: data.metadata ?? null,
    })
  } catch (error) {
    console.warn('GET /api/user-tour error', error)
    return responseOk({ slug, status: 'not_started' as TourStatus })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const { data: existingRow, error: fetchError } = await supabase
      .from('user_tour_state')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('tour_slug', parsed.data.slug)
      .maybeSingle<Pick<UserTourStateRow, 'id' | 'created_at'>>()

    if (fetchError) {
      console.error('POST /api/user-tour fetch existing error', fetchError)
      return NextResponse.json({ ok: false, error: 'Failed to save tour state' }, { status: 500 })
    }

    const createdAt = existingRow?.created_at ?? now
    const row: UserTourStateRow = {
      user_id: userId,
      tour_slug: parsed.data.slug,
      status: parsed.data.status,
      metadata: parsed.data.metadata ?? null,
      updated_at: now,
      created_at: createdAt,
    }

    const { data, error } = await supabase
      .from('user_tour_state')
      .upsert(row, { onConflict: 'user_id,tour_slug' })
      .select('id, status, updated_at, metadata, created_at')
      .maybeSingle()

    if (error) {
      console.error('POST /api/user-tour upsert error', error)
      return NextResponse.json({ ok: false, error: 'Failed to save tour state' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      state: {
        ...row,
        id: data?.id ?? existingRow?.id ?? null,
      },
    })
  } catch (error) {
    console.error('POST /api/user-tour error', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 })
  }
}
