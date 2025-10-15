'use client'

import type { ClosetItemSummary } from '@/lib/closet'
import type { OutfitPieceRecommendation, OutfitSource, OutfitSuggestionResponse } from '@/types/outfit'

export interface StylistMessagePayload {
  message: string
  context?: string
  userProfile?: {
    gender?: string
    age?: number
    favoriteColors?: string[]
    favoriteStyles?: string[]
  }
  closetItems?: ClosetItemSummary[]
  imageColors?: string[]
  imageDescription?: string
  mode?: 'assistant' | 'stylist'
}

export interface StylistMessageResponse {
  response?: string
  reply?: string
  meta?: Record<string, unknown>
}

export interface OutfitSuggestionPayload {
  occasion: string
  weather: {
    temperature: number
    condition: string
    humidity: number
    location: string
  }
  userProfile?: {
    gender?: string
    age?: number
    favoriteColors?: string[]
    favoriteStyles?: string[]
  }
  userId?: string
  closetItems?: ClosetItemSummary[]
}

export interface GeneratedImageResult {
  blob: Blob
  fileId: string | null
  contentType: string
  avatarUrl?: string
  storagePath?: string
}

export interface GenerateImageProfileInput {
  gender?: string
  heightCm?: number
  weightKg?: number
  photoUrl?: string
  displayName?: string
}

export interface GenerateImageContextInput {
  occasion?: string
  location?: string
  temperatureC?: number
  condition?: string
}

export interface GenerateImagePayload {
  prompt?: string
  purpose?: 'concept' | 'avatar'
  outfit?: OutfitSuggestionResponse
  profile?: GenerateImageProfileInput
  context?: GenerateImageContextInput
  metadata?: Record<string, unknown>
}

export async function sendStylistMessage(
  payload: StylistMessagePayload
): Promise<StylistMessageResponse> {
  const res = await fetch('/api/stylist-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Stylist chat failed: ${res.status}`)
  }
  return res.json()
}

export async function getOutfitSuggestion(
  payload: OutfitSuggestionPayload
): Promise<OutfitSuggestionResponse> {
  const res = await fetch('/api/outfit-suggestion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Outfit suggestion failed: ${res.status}`)
  }
  return res.json()
}

export async function generateImage(input: string | GenerateImagePayload): Promise<GeneratedImageResult> {
  const body = typeof input === 'string' ? { prompt: input } : input

  const res = await fetch('/api/image-generator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let message = `Image generation failed: ${res.status}`
    try {
      const errorBody = await res.json()
      if (errorBody?.error) {
        message = typeof errorBody.error === 'string' ? errorBody.error : message
      }
    } catch {
      // ignore JSON parse errors and use default message
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const fileId = res.headers.get('X-Mistral-File-Id')
  const headerContentType = res.headers.get('Content-Type')
  const contentType = headerContentType ?? (blob.type || 'image/png')
  const avatarUrl = res.headers.get('X-Avatar-Url') ?? undefined
  const storagePath = res.headers.get('X-Avatar-Storage-Path') ?? undefined

  return { blob, fileId, contentType, avatarUrl, storagePath }
}

export type { OutfitPieceRecommendation, OutfitSource, OutfitSuggestionResponse }
