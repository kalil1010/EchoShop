import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'

import { getColorName } from '@/lib/imageAnalysis'
import { analyzeGarmentWithMistral, segmentGarmentsWithMistral } from '@/lib/mistralVision'
import { moderateImageBuffer } from '@/lib/imageModeration'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError } from '@/lib/security'
import { buildPersonalizedColorAdvice, type ColorAdvice } from '@/lib/personalizedColors'
import { fetchUserStyleProfile } from '@/lib/server/userProfile'

export const runtime = 'nodejs'

type PixelBoundingBox = {
  left: number
  top: number
  width: number
  height: number
}

type ModerationSnapshot = {
  status: 'ok' | 'review' | 'blocked' | 'error'
  message?: string
  category?: string
  reasons?: string[]
}

type ProcessPiecePayload = {
  tempId: string
  outfitGroupId: string
  garmentType: 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'
  detectionLabel: string
  detectionConfidence: number
  provider: string
  boundingBox: PixelBoundingBox
  dominantColors: string[]
  primaryHex: string | null
  colorNames: string[]
  aiPrompt: string | null
  moderation: ModerationSnapshot
  previewDataUrl: string
  colorAdvice?: ColorAdvice | null
  mistralColors?: Array<{ name: string; hex: string }>
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const ensureHex = (hex: string): string => {
  const trimmed = hex.trim()
  if (!trimmed) return '#000000'
  const normalised = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return normalised.toUpperCase()
}

const mapSuggestedType = (value?: string | null): 'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory' => {
  const normal = (value ?? '').toLowerCase()
  if (normal.includes('foot') || normal.includes('shoe') || normal.includes('sandal') || normal.includes('boot')) return 'footwear'
  if (normal.includes('pant') || normal.includes('jean') || normal.includes('trouser') || normal.includes('skirt') || normal.includes('short')) return 'bottom'
  if (normal.includes('coat') || normal.includes('jacket') || normal.includes('hoodie') || normal.includes('outer')) return 'outerwear'
  if (normal.includes('accessory') || normal.includes('hat') || normal.includes('scarf') || normal.includes('bag') || normal.includes('belt')) return 'accessory'
  return 'top'
}

const mapLabelToType = (label?: string, fallback?: string) => {
  if (label) {
    const mapped = mapSuggestedType(label)
    if (mapped) return mapped
  }
  if (fallback) {
    const mapped = mapSuggestedType(fallback)
    if (mapped) return mapped
  }
  return 'top'
}

const toDataUrl = (buffer: Buffer, mimeType: string) => `data:${mimeType};base64,${buffer.toString('base64')}`

const MODERATION_SEVERITY: Record<ModerationSnapshot['status'], number> = {
  ok: 0,
  review: 1,
  error: 1,
  blocked: 2,
}

const mergeModeration = (current: ModerationSnapshot, candidate: ModerationSnapshot): ModerationSnapshot => {
  if (candidate.status === 'ok') {
    return current
  }
  const severityCurrent = MODERATION_SEVERITY[current.status] ?? 0
  const severityCandidate = MODERATION_SEVERITY[candidate.status] ?? 0
  const reasonSet = new Set<string>(current.reasons ?? [])
  candidate.reasons?.forEach((reason) => {
    if (reason) {
      reasonSet.add(reason)
    }
  })
  const mergedReasons = reasonSet.size ? Array.from(reasonSet) : undefined
  if (severityCandidate > severityCurrent) {
    return {
      status: candidate.status,
      message: candidate.message ?? current.message,
      category: candidate.category ?? current.category,
      reasons: mergedReasons,
    }
  }
  if (severityCandidate === severityCurrent) {
    return {
      status: current.status,
      message: current.message ?? candidate.message,
      category: current.category ?? candidate.category,
      reasons: mergedReasons,
    }
  }
  return {
    status: current.status,
    message: current.message ?? candidate.message,
    category: current.category ?? candidate.category,
    reasons: mergedReasons,
  }
}

const buildPixelBoundingBox = (
  box: { x: number; y: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  paddingRatio = 0.08,
): PixelBoundingBox => {
  const rawLeft = clamp(Math.round(box.x * imageWidth), 0, imageWidth - 1)
  const rawTop = clamp(Math.round(box.y * imageHeight), 0, imageHeight - 1)
  const rawWidth = clamp(Math.round(box.width * imageWidth), 1, imageWidth - rawLeft)
  const rawHeight = clamp(Math.round(box.height * imageHeight), 1, imageHeight - rawTop)

  const padX = Math.max(4, Math.round(rawWidth * paddingRatio))
  const padY = Math.max(4, Math.round(rawHeight * paddingRatio))

  const left = clamp(rawLeft - padX, 0, imageWidth - 1)
  const top = clamp(rawTop - padY, 0, imageHeight - 1)
  const right = clamp(rawLeft + rawWidth + padX, left + 1, imageWidth)
  const bottom = clamp(rawTop + rawHeight + padY, top + 1, imageHeight)

  return {
    left,
    top,
    width: Math.max(8, right - left),
    height: Math.max(8, bottom - top),
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const userProfile = await fetchUserStyleProfile(userId)

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || 'image/jpeg'

    const metadata = await sharp(originalBuffer, { failOn: 'none' }).metadata()
    const imageWidth = metadata.width ?? 0
    const imageHeight = metadata.height ?? 0
    if (!imageWidth || !imageHeight) {
      return NextResponse.json({ error: 'Unable to read uploaded image' }, { status: 400 })
    }

    let detections = await segmentGarmentsWithMistral(originalBuffer, mimeType)
    const warnings: string[] = []
    if (!detections.length) {
      warnings.push('Mistral segmentation could not isolate garments. Please review the single detected item manually.')
      detections = [
        {
          label: 'Garment',
          garmentType: 'top',
          confidence: 0.5,
          boundingBox: { x: 0.02, y: 0.05, width: 0.96, height: 0.9 },
        },
      ]
    }

    const outfitGroupId = uuidv4()
    const pieces: ProcessPiecePayload[] = []

    for (const detection of detections) {
      const tempId = uuidv4()
      const pixelBox = buildPixelBoundingBox(detection.boundingBox, imageWidth, imageHeight)

      const crop = sharp(originalBuffer, { failOn: 'none' }).extract({
        left: pixelBox.left,
        top: pixelBox.top,
        width: pixelBox.width,
        height: pixelBox.height,
      })

      const jpegBuffer = await crop.clone().jpeg({ quality: 88 }).toBuffer()
      const pngBuffer = await crop.clone().png({ quality: 92 }).toBuffer()
      const previewDataUrl = toDataUrl(jpegBuffer, 'image/jpeg')

      let moderation: ModerationSnapshot = { status: 'ok' }

      try {
        const sightOutcome = await moderateImageBuffer(pngBuffer, {
          filename: `${tempId}.png`,
          contentType: 'image/png',
        })
        if (!sightOutcome.ok) {
          const sightStatus: ModerationSnapshot['status'] = sightOutcome.type === 'blocked' ? 'blocked' : 'review'
          const candidate: ModerationSnapshot = {
            status: sightStatus,
            message: sightOutcome.message,
            category: sightOutcome.category ?? 'sightengine',
            reasons: sightOutcome.reasons,
          }
          moderation = mergeModeration(moderation, candidate)
          const warningMessage = sightOutcome.type === 'blocked'
            ? `"${detection.label}" blocked by moderation: ${sightOutcome.message}`
            : `"${detection.label}" needs manual review: ${sightOutcome.message}`
          warnings.push(warningMessage)
          if (sightOutcome.type === 'blocked') {
            pieces.push({
              tempId,
              outfitGroupId,
              garmentType: mapLabelToType(detection.garmentType, detection.label),
              detectionLabel: detection.label,
              detectionConfidence: detection.confidence ?? 0.5,
              provider: 'mistral-vision',
              boundingBox: pixelBox,
              dominantColors: [],
              primaryHex: null,
              colorNames: [],
              aiPrompt: null,
              moderation,
              previewDataUrl,
              colorAdvice: null,
              mistralColors: [],
            })
            continue
          }
        }
      } catch (moderationError) {
        console.warn('[closet/process] sightengine check failed', moderationError)
        const candidate: ModerationSnapshot = {
          status: 'review',
          message: 'Image moderation unavailable. Please verify manually.',
          category: 'sightengine',
          reasons: ['moderation_unavailable'],
        }
        moderation = mergeModeration(moderation, candidate)
        warnings.push(`"${detection.label}" requires manual review: moderation service unavailable.`)
      }

      const analysis = await analyzeGarmentWithMistral(jpegBuffer, 'image/jpeg')

      const seenHex = new Set<string>()
      const mistralColors = analysis?.colors
        ? analysis.colors
            .map((color) => ({
              name: color.name?.trim() || getColorName(color.hex),
              hex: ensureHex(color.hex),
            }))
            .filter((entry) => {
              if (!/^#[0-9A-F]{6}$/.test(entry.hex)) return false
              if (seenHex.has(entry.hex)) return false
              seenHex.add(entry.hex)
              return true
            })
        : []

      const dominantColors = mistralColors.map((color) => color.hex)
      const primaryHex = dominantColors[0] ?? null
      const colorNames = mistralColors.map((color) => color.name)
      const colorAdvice = buildPersonalizedColorAdvice(
        mistralColors.map((color) => ({ name: color.name, hex: color.hex })),
        analysis?.suggestedType ?? detection.garmentType,
        userProfile,
      )

      if (analysis) {
        if (analysis.safety.status !== 'ok') {
          const candidate: ModerationSnapshot = {
            status: analysis.safety.status,
            message: analysis.safety.reasons.join('; ') || (analysis.safety.status === 'blocked'
              ? 'Item flagged by AI safety review.'
              : 'AI suggests manual review.'),
            category: 'mistral-safety',
            reasons: analysis.safety.reasons.length ? analysis.safety.reasons : undefined,
          }
          moderation = mergeModeration(moderation, candidate)
          const warningMessage = candidate.status === 'blocked'
            ? `"${detection.label}" flagged by AI safety: ${candidate.message}`
            : `"${detection.label}" may need review: ${candidate.message}`
          warnings.push(warningMessage)
        }
      } else {
        const candidate: ModerationSnapshot = {
          status: 'review',
          message: 'Vision safety assessment unavailable. Please verify manually.',
          category: 'mistral-safety',
          reasons: ['analysis_unavailable'],
        }
        moderation = mergeModeration(moderation, candidate)
        warnings.push(`"${detection.label}" requires manual review: Vision analysis unavailable.`)
      }

      const resolvedType = analysis?.suggestedType
        ? mapLabelToType(analysis.suggestedType, detection.label)
        : mapLabelToType(detection.garmentType, detection.label)

      pieces.push({
        tempId,
        outfitGroupId,
        garmentType: resolvedType,
        detectionLabel: detection.label,
        detectionConfidence: detection.confidence ?? 0.5,
        provider: 'mistral-vision',
        boundingBox: pixelBox,
        dominantColors,
        primaryHex,
        colorNames,
        aiPrompt: analysis?.description ?? null,
        moderation,
        previewDataUrl,
        colorAdvice,
        mistralColors,
      })
    }

    return NextResponse.json({
      ok: true,
      outfitGroupId,
      pieces,
      warnings,
      metadata: {
        originalFileName: file.name,
        originalMimeType: mimeType,
        width: imageWidth,
        height: imageHeight,
      },
    })
  } catch (error) {
    console.error('[closet/process] failed', error)
    const mapped = mapSupabaseError(error)
    if (mapped instanceof Error) {
      return NextResponse.json({ error: mapped.message }, { status: 500 })
    }
    return NextResponse.json({ error: 'Unexpected error occurred' }, { status: 500 })
  }
}
