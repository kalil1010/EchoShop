import { getSupabaseClient } from '@/lib/supabaseClient'
import { mapSupabaseError, requireSessionUser, sanitizeText } from '@/lib/security'
import { NewSavedPalette } from '@/types/palette'

interface PaletteRow {
  id?: string
  user_id: string
  name: string
  base_hex: string
  dominant_hexes: string[]
  colors?: string[]
  rich_matches: unknown
  plan: unknown
  source: string | null
  created_at: string
  updated_at: string
}

const toSafeName = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const cleaned = sanitizeText(value, { maxLength: 120 })
  return cleaned || fallback
}

export async function savePaletteForUser(payload: NewSavedPalette, paletteId?: string): Promise<string> {
  const supabase = getSupabaseClient()
  const sessionUserId = await requireSessionUser(supabase)

  const now = new Date().toISOString()
  const defaultName = `${payload.source === 'closet' ? 'Closet' : 'Analyzer'} palette ${now}`
  const paletteName = toSafeName(payload.name, defaultName)

  const dominantHexes = Array.isArray(payload.dominantHexes)
    ? payload.dominantHexes.filter((hex): hex is string => typeof hex === 'string' && hex.trim().length > 0).slice(0, 24)
    : []

  const row: PaletteRow = {
    user_id: sessionUserId,
    name: paletteName,
    base_hex: payload.baseHex,
    dominant_hexes: dominantHexes,
    colors: dominantHexes,
    rich_matches: payload.richMatches ?? null,
    plan: payload.plan ?? null,
    source: payload.source ?? null,
    created_at: now,
    updated_at: now,
  }

  if (paletteId) {
    row.id = paletteId
  }

  const { data, error } = await supabase
    .from('palettes')
    .upsert(row, { onConflict: 'id' })
    .select('id')
    .maybeSingle()

  if (error) {
    throw mapSupabaseError(error)
  }

  const record = (data ?? null) as { id: string } | null
  return record?.id ?? row.id ?? ''
}
