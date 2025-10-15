import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { buildAvatarPrompt } from '@/lib/imagePrompts'
import { generateImageFromPrompt } from '@/lib/mistralImage'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import type { OutfitSuggestionResponse } from '@/types/outfit'

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

const persistAvatarRender = async (params: {
  arrayBuffer: ArrayBuffer
  contentType: string
  prompt: string
  purpose: string
}): Promise<{ avatarUrl?: string; storagePath?: string }> => {
  try {
    const routeClient = createRouteClient()
    const {
      data: { user },
    } = await routeClient.auth.getUser()

    if (!user) {
      return {}
    }

    const { bucket, folder } = getSupabaseStorageConfig()
    const extension = toExtension(params.contentType)
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).slice(2, 8)
    const safeUserId = user.id.replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'user'
    const segments = [folder, 'avatars', safeUserId, `${timestamp}-${randomSuffix}.${extension}`].filter(Boolean)
    const storagePath = segments.join('/')

    const blob = new Blob([params.arrayBuffer], { type: params.contentType })
    const upload = await routeClient.storage
      .from(bucket)
      .upload(storagePath, blob, { upsert: true, contentType: params.contentType, cacheControl: '3600' })

    if (upload.error) {
      console.warn('Failed to upload avatar render to storage:', upload.error)
      return {}
    }

    const { data: publicUrlData } = routeClient.storage.from(bucket).getPublicUrl(storagePath)
    const avatarUrl = publicUrlData?.publicUrl

    try {
      const serviceClient = createServiceClient()
      await serviceClient.from('avatar_renders').upsert(
        {
          user_id: user.id,
          prompt: params.prompt,
          purpose: params.purpose,
          storage_path: storagePath,
          public_url: avatarUrl ?? null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,storage_path' }
      )
    } catch (dbError) {
      console.warn('Failed to record avatar render metadata:', dbError)
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
