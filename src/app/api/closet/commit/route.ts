import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { mapClothingRow } from '@/lib/closet'
import { moderateImageBuffer } from '@/lib/imageModeration'
import { sanitizeText, mapSupabaseError, isPermissionError } from '@/lib/security'
import { buildStoragePath } from '@/lib/storage'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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

const DETECTION_COLUMNS = ['detection_label', 'detection_confidence', 'detection_provider'] as const
const MODERATION_COLUMNS = ['moderation_status', 'moderation_message', 'moderation_category', 'moderation_reasons'] as const

const OPTIONAL_COLUMN_GROUPS: Record<string, readonly string[]> = {}
for (const column of DETECTION_COLUMNS) {
  OPTIONAL_COLUMN_GROUPS[column] = DETECTION_COLUMNS
}
for (const column of MODERATION_COLUMNS) {
  OPTIONAL_COLUMN_GROUPS[column] = MODERATION_COLUMNS
}

const MISSING_COLUMN_REGEX = /Could not find the '([^']+)' column/i

const stripOptionalColumns = (rows: Record<string, unknown>[], missingColumn: string): Record<string, unknown>[] => {
  const group = OPTIONAL_COLUMN_GROUPS[missingColumn] ?? [missingColumn]
  return rows.map((row) => {
    const clone = { ...row }
    for (const column of group) {
      delete clone[column]
    }
    return clone
  })
}

const extractMissingColumn = (message?: string | null): string | null => {
  if (!message) return null
  const match = MISSING_COLUMN_REGEX.exec(message)
  return match ? match[1] : null
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const uploadedPaths: string[] = []
  let supabase: SupabaseClient | null = null

  try {
    const { userId } = await resolveAuthenticatedUser(request)
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing.')
    }
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

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

    let rowsToInsert: Record<string, unknown>[] = inserts
    let insertResult = await supabase
      .from('clothing')
      .insert(rowsToInsert)
      .select('*')

    if (insertResult.error) {
      const missingColumn = extractMissingColumn(insertResult.error.message)
      if (missingColumn) {
        rowsToInsert = stripOptionalColumns(rowsToInsert, missingColumn)
        insertResult = await supabase
          .from('clothing')
          .insert(rowsToInsert)
          .select('*')
      }
    }

    if (insertResult.error) {
      throw insertResult.error
    }

    const mapped = (insertResult.data ?? []).map(mapClothingRow)

    return NextResponse.json({
      ok: true,
      outfitGroupId: body.outfitGroupId,
      items: mapped,
    })
  } catch (error) {
    console.error('[closet/commit] failed', error)
    if (uploadedPaths.length && supabase) {
      try {
        const { bucket } = getSupabaseStorageConfig()
        await supabase.storage.from(bucket).remove(uploadedPaths)
      } catch (cleanupError) {
        console.warn('[closet/commit] failed to cleanup uploads', cleanupError)
      }
    }

    const mapped = mapSupabaseError(error)
    let status = 500
    let message = 'Failed to store garments.'

    if (mapped instanceof Error) {
      message = mapped.message || message
      if (isPermissionError(mapped)) {
        status = mapped.reason === 'auth' ? 401 : 403
      } else {
        status = 400
      }
    }
    return NextResponse.json({ error: message }, { status })
  }
}

