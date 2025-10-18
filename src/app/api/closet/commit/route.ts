import { NextRequest, NextResponse } from 'next/server'

import { mapClothingRow } from '@/lib/closet'
import { moderateImageBuffer } from '@/lib/imageModeration'
import { sanitizeText, mapSupabaseError, requireSessionUser } from '@/lib/security'
import { buildStoragePath } from '@/lib/storage'
import { createRouteClient } from '@/lib/supabaseServer'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'

type IncomingPiece = {
  tempId: string
  garmentType: string
  accepted: boolean
  dominantColors: string[]
  primaryHex?: string | null
  colorNames?: string[]
  aiPrompt?: string | null
  detectionLabel?: string | null
  detectionConfidence?: number | null
  detectionProvider?: string | null
  moderation?: {
    status: 'ok' | 'review' | 'blocked' | 'error'
    message?: string
    category?: string | null
    reasons?: string[]
  } | null
  previewDataUrl: string
  description?: string | null
  outfitGroupId: string
}

type CommitmentRequest = {
  outfitGroupId: string
  pieces: IncomingPiece[]
  originalFileName?: string
}

const DATA_URL_REGEX = /^data:(.+);base64,(.*)$/

const decodeDataUrl = (dataUrl: string): { buffer: Buffer; mimeType: string } => {
  const match = DATA_URL_REGEX.exec(dataUrl)
  if (!match) {
    throw new Error('Invalid data URL provided for garment image.')
  }
  const mimeType = match[1] || 'image/jpeg'
  const base64 = match[2]
  return { buffer: Buffer.from(base64, 'base64'), mimeType }
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = createRouteClient()
  const uploadedPaths: string[] = []

  try {
    const userId = await requireSessionUser(supabase)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as CommitmentRequest
    if (!body?.pieces || !Array.isArray(body.pieces) || body.pieces.length === 0) {
      return NextResponse.json({ error: 'No garment pieces supplied.' }, { status: 400 })
    }

    const acceptedPieces = body.pieces.filter((piece) => piece.accepted)
    if (!acceptedPieces.length) {
      return NextResponse.json({ error: 'You must accept at least one detected garment.' }, { status: 400 })
    }

    const { bucket } = getSupabaseStorageConfig()
    const inserts = []

    for (const piece of acceptedPieces) {
      const { buffer, mimeType } = decodeDataUrl(piece.previewDataUrl)

      if (piece.moderation?.status === 'blocked' || piece.moderation?.status === 'review') {
        const review = await moderateImageBuffer(buffer, {
          filename: `${piece.tempId}.jpg`,
          contentType: mimeType,
        })
        if (!review.ok) {
          return NextResponse.json(
            { error: `Unable to persist "${piece.detectionLabel ?? 'garment'}": ${review.message}` },
            { status: 400 },
          )
        }
      }

      const extension = mimeType.includes('png') ? 'png' : 'jpg'
      const originalName = `${piece.tempId}.${extension}`
      const storagePath = buildStoragePath({ userId, originalName })

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) {
        throw mapSupabaseError(uploadError)
      }
      uploadedPaths.push(storagePath)

      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(storagePath)
      const publicUrl = publicUrlData?.publicUrl ?? ''

      const nowIso = new Date().toISOString()
      const garmentType = ['top', 'bottom', 'footwear', 'outerwear', 'accessory'].includes(piece.garmentType)
        ? piece.garmentType
        : 'top'

      inserts.push({
        user_id: userId,
        image_url: publicUrl,
        storage_path: storagePath,
        outfit_group_id: piece.outfitGroupId ?? body.outfitGroupId,
        garment_type: garmentType,
        clothing_type: garmentType,
        dominant_colors: piece.dominantColors ?? [],
        primary_hex: piece.primaryHex ?? null,
        color_names: piece.colorNames ?? null,
        ai_prompt: piece.aiPrompt ?? null,
        detection_label: piece.detectionLabel ?? null,
        detection_confidence: piece.detectionConfidence ?? null,
        detection_provider: piece.detectionProvider ?? null,
        moderation_status: piece.moderation?.status ?? null,
        moderation_message: piece.moderation?.message ?? null,
        moderation_category: piece.moderation?.category ?? null,
        moderation_reasons: piece.moderation?.reasons ?? null,
        description: piece.description ? sanitizeText(piece.description, { maxLength: 240 }) : null,
        created_at: nowIso,
        updated_at: nowIso,
      })
    }

    const { data, error } = await supabase
      .from('clothing')
      .insert(inserts)
      .select('*')

    if (error) {
      throw mapSupabaseError(error)
    }

    const mapped = (data ?? []).map(mapClothingRow)

    return NextResponse.json({
      ok: true,
      outfitGroupId: body.outfitGroupId,
      items: mapped,
    })
  } catch (error) {
    console.error('[closet/commit] failed', error)
    if (uploadedPaths.length) {
      try {
        const { bucket } = getSupabaseStorageConfig()
        await supabase.storage.from(bucket).remove(uploadedPaths)
      } catch (cleanupError) {
        console.warn('[closet/commit] failed to cleanup uploads', cleanupError)
      }
    }

    const mapped = mapSupabaseError(error)
    const message = mapped instanceof Error ? mapped.message : 'Failed to store garments.'
    const status = mapped instanceof Error ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
