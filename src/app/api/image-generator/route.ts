import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { buildAvatarPrompt } from '@/lib/imagePrompts'
import { generateImageFromPrompt } from '@/lib/mistralImage'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import type { OutfitSuggestionResponse } from '@/types/outfit'
import type { User } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const PromptSchema = z.string().trim().min(4, 'Prompt is too short').max(800, 'Prompt is too long')

const OutfitPieceSchema = z.object({
  summary: z.string(),
  color: z.string().optional(),
  source: z.enum(['closet', 'online']).optional(),
  sourceUrl: z.string().url().optional(),
  onlinePieceId: z.string().optional(),
})

const OutfitSchema = z.object({
  top: OutfitPieceSchema,
  bottom: OutfitPieceSchema,
  footwear: OutfitPieceSchema,
  accessories: z.array(OutfitPieceSchema).optional(),
  outerwear: OutfitPieceSchema.optional(),
  styleNotes: z.string().optional(),
})

const ProfileSchema = z.object({
  gender: z.string().optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  photoUrl: z.string().url().optional(),
  displayName: z.string().optional(),
})

const ContextSchema = z.object({
  occasion: z.string().optional(),
  location: z.string().optional(),
  temperatureC: z.number().optional(),
  condition: z.string().optional(),
})

const PayloadSchema = z
  .object({
    prompt: PromptSchema.optional(),
    purpose: z.enum(['concept', 'avatar']).optional(),
    outfit: OutfitSchema.optional(),
    profile: ProfileSchema.optional(),
    context: ContextSchema.optional(),
    metadata: z.record(z.any()).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.prompt && !value.outfit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either prompt or outfit data must be provided',
        path: ['prompt'],
      })
    }
  })

const normaliseOutfit = (input: z.infer<typeof OutfitSchema>): OutfitSuggestionResponse => ({
  top: input.top,
  bottom: input.bottom,
  footwear: input.footwear,
  accessories: input.accessories ?? [],
  outerwear: input.outerwear,
  styleNotes: input.styleNotes ?? '',
})

const toExtension = (contentType: string): string => {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
  if (contentType.includes('webp')) return 'webp'
  return 'png'
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

type AuthSource = 'cookie' | 'bearer' | null

type AuthResolution = {
  user: User | null
  source: AuthSource
}

const resolveAuthenticatedUser = async (request: NextRequest): Promise<AuthResolution> => {
  try {
    const routeClient = createRouteClient()
    const {
      data: { user },
      error,
    } = await routeClient.auth.getUser()
    if (user) return { user, source: 'cookie' }
    if (error && !isAuthSessionMissingError(error)) console.warn('[avatar] cookie auth error', error)
  } catch (err) {
    if (!isAuthSessionMissingError(err)) console.warn('[avatar] cookie auth threw', err)
  }

  const token = extractBearerToken(request)
  if (!token) return { user: null, source: null }

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient.auth.getUser(token)
    if (error) {
      console.warn('[avatar] bearer validation failed', error)
      return { user: null, source: null }
    }
    if (data?.user) return { user: data.user, source: 'bearer' }
  } catch (err) {
    console.warn('[avatar] bearer auth threw', err)
  }

  return { user: null, source: null }
}

const persistAvatarRender = async (params: {
  arrayBuffer: ArrayBuffer
  contentType: string
  prompt: string
  purpose: string
  userId?: string | null
}): Promise<{ avatarUrl?: string; storagePath?: string }> => {
  const userId = params.userId
  if (!userId) {
    console.warn('[avatar] persist skipped: no authenticated user')
    return {}
  }

  try {
    const { bucket, folder } = getSupabaseStorageConfig()
    const extension = toExtension(params.contentType)
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).slice(2, 8)
    const safeUserId = userId.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'user'
    const segments = [folder, 'avatars', safeUserId, `${timestamp}-${randomSuffix}.${extension}`].filter(Boolean)
    const storagePath = segments.join('/')

    const fileBuffer = Buffer.from(params.arrayBuffer)
    const serviceClient = createServiceClient()
    const upload = await serviceClient.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, { upsert: true, contentType: params.contentType, cacheControl: '3600' })

    if (upload.error) {
      console.warn('[avatar] storage upload failed', {
        error: upload.error,
        bucket,
        storagePath,
      })
      return {}
    }

    const { data: publicUrlData } = serviceClient.storage.from(bucket).getPublicUrl(storagePath)
    const avatarUrl = publicUrlData?.publicUrl

    try {
      await serviceClient.from('avatar_renders').upsert(
        {
          user_id: userId,
          prompt: params.prompt,
          purpose: params.purpose,
          storage_path: storagePath,
          public_url: avatarUrl ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,storage_path' }
      )
    } catch (dbError) {
      console.warn('[avatar] failed to record metadata', dbError)
    }

    return { avatarUrl: avatarUrl ?? undefined, storagePath }
  } catch (error) {
    console.warn('Avatar persistence skipped:', error)
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = PayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const payload = parsed.data
    const purpose = payload.purpose ?? (payload.outfit ? 'avatar' : 'concept')

    let promptText: string | null = null

    if (payload.outfit) {
      const normalisedOutfit = normaliseOutfit(payload.outfit)
      const autoPrompt = buildAvatarPrompt({
        outfit: normalisedOutfit,
        profile: payload.profile ?? undefined,
        context: payload.context ?? undefined,
        metadata: payload.metadata ?? undefined,
      })
      promptText = payload.prompt ? `${payload.prompt.trim()}\n\n${autoPrompt}` : autoPrompt
    } else if (payload.prompt) {
      promptText = payload.prompt.trim()
    }

    if (!promptText) {
      return NextResponse.json({ error: 'Unable to create prompt for image generation' }, { status: 400 })
    }

    const { user, source } = await resolveAuthenticatedUser(request)
    const hasBearer = Boolean(extractBearerToken(request))
    console.debug('[avatar] auth context', { userId: user?.id ?? null, source, hasBearer })

    const { arrayBuffer, contentType, fileId } = await generateImageFromPrompt(promptText)

    const buffer = Buffer.from(arrayBuffer)

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Avatar-Purpose': purpose,
    }

    if (fileId) {
      headers['X-Mistral-File-Id'] = fileId
    }

    const persistence = await persistAvatarRender({
      arrayBuffer,
      contentType,
      prompt: promptText,
      purpose,
      userId: user?.id,
    })

    if (persistence.avatarUrl) {
      headers['X-Avatar-Url'] = persistence.avatarUrl
    }

    if (persistence.storagePath) {
      headers['X-Avatar-Storage-Path'] = persistence.storagePath
    }

    return new NextResponse(buffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Image generation failed:', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

