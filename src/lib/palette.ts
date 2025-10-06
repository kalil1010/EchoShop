import { getSupabaseClient } from '@/lib/supabaseClient'
import { NewSavedPalette } from '@/types/palette'

interface PaletteInsert {
  id?: string
  owner_id: string
  base_hex: string
  dominant_hexes: string[]
  rich_matches: unknown
  plan: unknown
  source: string | null
  created_at: string
  updated_at: string
}

export async function savePaletteForUser(payload: NewSavedPalette, paletteId?: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()

  if (userError) {
    throw new Error(`Unable to determine current user: ${userError.message}`)
  }

  const user = userData?.user
  if (!user) {
    throw new Error('User must be signed in to save a palette.')
  }

  const now = new Date().toISOString()

  const ownerId = user.id

  const row: PaletteInsert = {
    owner_id: ownerId,
    base_hex: payload.baseHex,
    dominant_hexes: payload.dominantHexes,
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
    console.error('[palettes] save failed:', error)
    throw new Error(`Save failed (${error.code ?? 'unknown'}): ${error.message}`)
  }

  const record = (data ?? null) as { id: string } | null
  return record?.id ?? row.id ?? ''
}
