import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'

const SavePayloadSchema = z.object({
  storagePath: z.string().min(1, 'storagePath required'),
  publicUrl: z.string().url().optional(),
  prompt: z.string().optional(),
})

const mapRecord = (row: any) => ({
  userId: row.user_id as string,
  storagePath: row.storage_path as string,
  publicUrl: (row.public_url as string | null) ?? null,
  prompt: (row.prompt as string) ?? '',
  purpose: (row.purpose as string) ?? 'avatar',
  createdAt: (row.created_at as string) ?? new Date().toISOString(),
})

export async function GET() {
  try {
    const routeClient = createRouteClient()
    const {
      data: { user },
      error: userError,
    } = await routeClient.auth.getUser()

    if (userError) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ items: [] }, { status: 200 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', 'gallery')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch avatar renders:', error)
      return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 })
    }

    return NextResponse.json({
      items: Array.isArray(data) ? data.map(mapRecord) : [],
    })
  } catch (error) {
    console.error('Avatar gallery GET failed:', error)
    return NextResponse.json({ error: 'Failed to load gallery' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = SavePayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const payload = parsed.data

    const routeClient = createRouteClient()
    const {
      data: { user },
      error: userError,
    } = await routeClient.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { data: existing, error: fetchError } = await serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('storage_path', payload.storagePath)
      .maybeSingle()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Failed to read existing avatar render:', fetchError)
    }

    const prompt = payload.prompt ?? (existing?.prompt as string | undefined) ?? 'Saved outfit avatar'
    const publicUrl = payload.publicUrl ?? (existing?.public_url as string | null) ?? null

    const upsertPayload = {
      user_id: user.id,
      storage_path: payload.storagePath,
      public_url: publicUrl,
      prompt,
      purpose: 'gallery',
      created_at: existing?.created_at ?? new Date().toISOString(),
    }

    const { error: upsertError } = await serviceClient
      .from('avatar_renders')
      .upsert(upsertPayload, { onConflict: 'user_id,storage_path' })

    if (upsertError) {
      console.error('Failed to save avatar render:', upsertError)
      return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 })
    }

    const { data, error } = await serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('storage_path', payload.storagePath)
      .maybeSingle()

    if (error || !data) {
      console.error('Failed to load saved avatar render:', error)
      return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 })
    }

    return NextResponse.json({ item: mapRecord(data) }, { status: 200 })
  } catch (error) {
    console.error('Avatar gallery POST failed:', error)
    return NextResponse.json({ error: 'Failed to save avatar' }, { status: 500 })
  }
}
