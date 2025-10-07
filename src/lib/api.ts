'use client'

import type { ClosetItemSummary } from '@/lib/closet'

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

export type OutfitSource = 'closet' | 'online'

export interface OutfitPieceRecommendation {
  summary: string
  color?: string
  source?: OutfitSource
  sourceUrl?: string
  onlinePieceId?: string
}

export interface OutfitSuggestionResponse {
  top: OutfitPieceRecommendation
  bottom: OutfitPieceRecommendation
  footwear: OutfitPieceRecommendation
  accessories: OutfitPieceRecommendation[]
  outerwear?: OutfitPieceRecommendation
  styleNotes: string
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

