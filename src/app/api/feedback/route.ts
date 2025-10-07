import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceClient, getAuthenticatedUserId } from '@/lib/supabaseServer'

const ReactionSchema = z.enum(['thumbs_up', 'thumbs_down', 'love', 'bookmark'])

const BodySchema = z.object({
  feature: z.string().min(1),
  reaction: ReactionSchema,
  comment: z.string().max(300).optional(),
  session_id: z.string().optional(),
})

const DEFAULT_COUNTS = {
  thumbs_up: 0,
  thumbs_down: 0,
  love: 0,
  bookmark: 0,
}

export async function GET(request: NextRequest) {
  const feature = request.nextUrl.searchParams.get('feature')
  if (!feature) {
    return NextResponse.json({ ok: false, error: 'Missing feature parameter' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('feature_feedback')
      .select('reaction')
      .eq('feature_slug', feature)

    if (error) {
      console.error('GET /api/feedback error', error)
      return NextResponse.json({ feature, counts: DEFAULT_COUNTS })
    }

    const counts = { ...DEFAULT_COUNTS }
    for (const row of data ?? []) {
      const reaction = row.reaction as keyof typeof counts
      if (reaction in counts) counts[reaction] += 1
    }

    return NextResponse.json({ feature, counts })
  } catch (error) {
    console.error('GET /api/feedback unexpected error', error)
    return NextResponse.json({ feature, counts: DEFAULT_COUNTS })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const userId = await getAuthenticatedUserId()

    const insertPayload = {
      feature_slug: parsed.data.feature,
      reaction: parsed.data.reaction,
      comment: parsed.data.comment ?? null,
      user_id: userId,
      session_id: parsed.data.session_id ?? null,
    }

    const { error } = await supabase.from('feature_feedback').insert(insertPayload)
    if (error) {
      console.error('POST /api/feedback insert error', error)
      return NextResponse.json({ ok: false, error: 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/feedback unexpected error', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 })
  }
}
