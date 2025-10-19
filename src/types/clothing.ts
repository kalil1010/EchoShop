import type { ColorAdvice, ColorSwatch } from '@/lib/personalizedColors'
export interface ClothingItem {
  id: string
  userId: string
  imageUrl: string
  storagePath?: string
  garmentType: 'top' | 'bottom' | 'footwear' | 'accessory' | 'outerwear'
  dominantColors: string[]
  // Optional AI-enriched fields
  primaryHex?: string
  colorNames?: string[]
  aiMatches?: {
    complementary: string
    analogous: string[]
    triadic: string[]
  }
  colorAdvice?: ColorAdvice
  mistralColors?: ColorSwatch[]
  aiPrompt?: string
  description?: string
  brand?: string
  season?: 'spring' | 'summer' | 'fall' | 'winter' | 'all'
  outfitGroupId?: string
  detection?: {
    label?: string
    confidence?: number
    provider?: string
  }
  moderation?: {
    status: 'ok' | 'review' | 'blocked' | 'error'
    message?: string | null
    category?: string | null
    reasons?: string[] | null
  }
  createdAt: Date
  updatedAt: Date
}

export interface ColorAnalysis {
  dominantColors: string[]
  colorPercentages: { [color: string]: number }
}
