import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import type { User } from '@supabase/supabase-js'

const SavePayloadSchema = z.object({
  storagePath: z.string().min(1, 'storagePath required'),
  publicUrl: z.string().url().optional(),
  prompt: z.string().optional(),
})

const DeletePayloadSchema = z.object({
  storagePath: z.string().min(1, 'storagePath required'),
})
type AvatarRenderRow = {
  user_id: string
  storage_path: string
  public_url: string | null
  prompt: string | null
  purpose: string | null
  created_at: string | null
}

const mapRecord = (row: AvatarRenderRow) => ({
  userId: row.user_id as string,
  storagePath: row.storage_path as string,
  publicUrl: (row.public_url as string | null) ?? null,
  prompt: (row.prompt as string) ?? '',
  purpose: (row.purpose as string) ?? 'avatar',
  createdAt: (row.created_at as string) ?? new Date().toISOString(),
})

type AuthSource = 'cookie' | 'bearer' | null

type AuthResolution = {
  user: User | null
  source: AuthSource
}

const extractBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get('authorization')
  if (!header) return null
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  return token.length ? token : null
}

const isAuthSessionMissingError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { name?: unknown; message?: unknown }
  const name = typeof candidate.name === 'string' ? candidate.name : ''
  const message = typeof candidate.message === 'string' ? candidate.message : ''
  return name === 'AuthSessionMissingError' || message.toLowerCase().includes('auth session missing')
}

const getAuthenticatedUser = async (request: NextRequest): Promise<AuthResolution> => {
  try {
    const routeClient = createRouteClient()
    const {
      data: { user },
      error,
    } = await routeClient.auth.getUser()
    if (user) {
      return { user, source: 'cookie' }
    }
    if (error && !isAuthSessionMissingError(error)) {
      console.warn('[avatar-gallery] cookie auth error', error)
    }
  } catch (err) {
    if (!isAuthSessionMissingError(err)) {
      console.warn('[avatar-gallery] cookie auth threw', err)
    }
  }

  const token = extractBearerToken(request)
  if (!token) {
    return { user: null, source: null }
  }

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.auth.getUser(token)
    if (error) {
      console.warn('[avatar-gallery] bearer validation failed', error)
      return { user: null, source: null }
    }
    if (data?.user) {
      return { user: data.user, source: 'bearer' }
    }
  } catch (err) {
    console.warn('[avatar-gallery] bearer auth threw', err)
  }

  return { user: null, source: null }
}

export async function GET(request: NextRequest) {
  try {
    const { user, source } = await getAuthenticatedUser(request)
    if (!user) {
      console.warn('[avatar-gallery] GET unauthorized', { source, hasAuthHeader: Boolean(extractBearerToken(request)) })
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    
    // Parse pagination parameters from query string
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50', 10), 200) // Max 200 items
    const offset = Math.max(Number.parseInt(searchParams.get('offset') || '0', 10), 0)

    let query = serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', 'gallery')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (offset > 0) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('[avatar-gallery] failed to fetch avatar renders:', error)
      return NextResponse.json({ error: 'Failed to load gallery', details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      items: Array.isArray(data) ? data.map(mapRecord) : [],
    })
  } catch (error) {
    console.error('[avatar-gallery] GET handler failed:', error)
    return NextResponse.json({ error: 'Failed to load gallery', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
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

    const { user, source } = await getAuthenticatedUser(request)

    if (!user) {
      console.warn('[avatar-gallery] auth error on POST', { source, hasAuthHeader: Boolean(extractBearerToken(request)) })
      return NextResponse.json(
        { error: 'Authentication required', details: 'No active session' },
        { status: 401 }
      )
    }

    const serviceClient = createServiceClient()

    const { data: existing, error: fetchError } = await serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('storage_path', payload.storagePath)
      .maybeSingle<AvatarRenderRow>()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('[avatar-gallery] failed to read existing avatar render:', fetchError)
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
      console.error('[avatar-gallery] failed to save avatar render:', upsertError)
      return NextResponse.json({ error: 'Failed to save avatar', details: upsertError.message }, { status: 500 })
    }

    const { data, error } = await serviceClient
      .from('avatar_renders')
      .select('*')
      .eq('user_id', user.id)
      .eq('storage_path', payload.storagePath)
      .maybeSingle<AvatarRenderRow>()

    if (error || !data) {
      console.error('[avatar-gallery] failed to load saved avatar render:', error)
      return NextResponse.json({ error: 'Failed to save avatar', details: error?.message }, { status: 500 })
    }

    return NextResponse.json({ item: mapRecord(data) }, { status: 200 })
  } catch (error) {
    console.error('[avatar-gallery] POST handler failed:', error)
    return NextResponse.json({ error: 'Failed to save avatar', details: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = DeletePayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { storagePath } = parsed.data
    const { user, source } = await getAuthenticatedUser(request)

    if (!user) {
      console.warn('[avatar-gallery] DELETE unauthorized', { source, hasAuthHeader: Boolean(extractBearerToken(request)) })
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const serviceClient = createServiceClient()

    const { error } = await serviceClient
      .from('avatar_renders')
      .delete()
      .eq('user_id', user.id)
      .eq('storage_path', storagePath)

    if (error) {
      console.error('[avatar-gallery] failed to delete avatar render:', error)
      return NextResponse.json({ error: 'Failed to delete avatar', details: error.message }, { status: 500 })
    }

    try {
      const { bucket } = getSupabaseStorageConfig()
      if (bucket) {
        const { data: remaining, error: remainingError } = await serviceClient
          .from('avatar_renders')
          .select('storage_path')
          .eq('storage_path', storagePath)
          .limit(1)

        if (!remainingError && (!remaining || remaining.length === 0)) {
          await serviceClient.storage.from(bucket).remove([storagePath])
        }
      }
    } catch (storageError) {
      console.warn('[avatar-gallery] storage removal skipped', storageError)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[avatar-gallery] DELETE handler failed:', error)
    return NextResponse.json(
      { error: 'Failed to delete avatar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
