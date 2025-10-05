import { getSupabaseClient } from '@/lib/supabaseClient'
import { buildStoragePath, getPublicStorageUrl, getStorageBucket, normaliseStoragePath, uploadToStorage } from '@/lib/storage'
import { ClothingItem } from '@/types/clothing'

export interface ClothingRow {
  id: string
  user_id: string
  image_url: string | null
  storage_path: string | null
  garment_type: ClothingItem['garmentType']
  dominant_colors: string[] | null
  primary_hex: string | null
  color_names: string[] | null
  ai_matches: unknown
  description: string | null
  brand: string | null
  season: ClothingItem['season'] | null
  created_at: string | null
  updated_at: string | null
}
type AiMatches = NonNullable<ClothingItem['aiMatches']>

function isAiMatches(value: unknown): value is AiMatches {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as {
    complementary?: unknown
    analogous?: unknown
    triadic?: unknown
  }
  return (
    typeof candidate.complementary === 'string' &&
    Array.isArray(candidate.analogous) &&
    candidate.analogous.every((entry) => typeof entry === 'string') &&
    Array.isArray(candidate.triadic) &&
    candidate.triadic.every((entry) => typeof entry === 'string')
  )
}

export function mapClothingRow(row: ClothingRow): ClothingItem {
  const storagePath = normaliseStoragePath(row.storage_path)
  const imageUrl = row.image_url || (storagePath ? getPublicStorageUrl(storagePath) : '')
  const aiMatches = isAiMatches(row.ai_matches)
    ? {
        complementary: row.ai_matches.complementary,
        analogous: [...row.ai_matches.analogous],
        triadic: [...row.ai_matches.triadic],
      }
    : undefined

  return {
    id: row.id,
    userId: row.user_id,
    imageUrl,
    storagePath: storagePath ?? undefined,
    garmentType: row.garment_type,
    dominantColors: row.dominant_colors ?? [],
    primaryHex: row.primary_hex ?? undefined,
    colorNames: row.color_names ?? undefined,
    aiMatches,
    description: row.description ?? undefined,
    brand: row.brand ?? undefined,
    season: row.season ?? 'all',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

export async function getUserClothing(userId: string): Promise<ClothingItem[]> {
  const supabase = getSupabaseClient()

  try {
    const { data, error } = await supabase
      .from('clothing')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const rows = (data ?? []) as ClothingRow[]
    return rows.map(mapClothingRow)
  } catch (error) {
    console.error('Failed to fetch clothing items:', error)
    return []
  }
}

export async function uploadClothingImage(userId: string, file: File): Promise<{ storagePath: string; publicUrl: string }> {
  const storagePath = buildStoragePath({ userId, originalName: file.name })
  const { publicUrl } = await uploadToStorage(storagePath, file, {
    contentType: file.type || 'image/webp',
    upsert: false,
    cacheControl: '3600',
  })
  return { storagePath, publicUrl }
}

export async function deleteClothingItem(item: ClothingItem): Promise<void> {
  const supabase = getSupabaseClient()
  const bucket = getStorageBucket()

  try {
    const { error } = await supabase.from('clothing').delete().eq('id', item.id).eq('user_id', item.userId)
    if (error) throw error

    const storagePath = normaliseStoragePath(item.storagePath) || null
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from(bucket).remove([storagePath])
      if (storageError) throw storageError
    }
  } catch (error) {
    console.error('Failed to delete clothing item:', error)
    throw error
  }
}

export function groupClothingByType(items: ClothingItem[]): { [key: string]: ClothingItem[] } {
  return items.reduce((groups, item) => {
    const type = item.garmentType
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(item)
    return groups
  }, {} as { [key: string]: ClothingItem[] })
}

export interface ClosetItemSummary {
  id: string
  garmentType: ClothingItem['garmentType']
  brand?: string
  description?: string
  dominantColors?: string[]
}

export function toClosetSummary(items: ClothingItem[], limit = 15): ClosetItemSummary[] {
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    garmentType: item.garmentType,
    brand: item.brand,
    description: item.description,
    dominantColors: item.dominantColors,
  }))
}

export function summariseClosetForPrompt(items: ClosetItemSummary[], limit = 20): string[] {
  return items.slice(0, limit).map((item) => {
    const brand = item.brand ? ` (${item.brand})` : ''
    const colours = item.dominantColors && item.dominantColors.length > 0 ? ` - Colours: ${item.dominantColors.join(', ')}` : ''
    const detail = item.description ? item.description : 'No description provided'
    return `${item.garmentType.toUpperCase()}${brand}: ${detail}${colours}`
  })
}
