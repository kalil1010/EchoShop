import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createServiceClient, getAuthenticatedUserId } from '@/lib/supabaseServer'

const BodySchema = z.object({
  event_name: z.string().min(1),
  user_id: z.string().uuid().nullable().optional(),
  payload: z.record(z.any()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const fallbackUserId = await getAuthenticatedUserId()

    const insertPayload = {
      event_name: parsed.data.event_name,
      user_id: parsed.data.user_id ?? fallbackUserId,
      payload: parsed.data.payload ?? null,
    }

    const { error } = await supabase.from('event_log').insert(insertPayload)
    if (error) {
      console.error('POST /api/event-log insert error', error)
      return NextResponse.json({ ok: false, error: 'Failed to record event' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/event-log unexpected error', error)
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 })
  }
}
