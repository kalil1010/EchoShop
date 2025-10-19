import { createServiceClient } from '@/lib/supabaseServer'
import type { UserStyleProfile } from '@/lib/personalizedColors'

type ProfileRow = {
  gender: string | null
  age: number | null
  favorite_colors: string[] | null
  disliked_colors: string[] | null
  favorite_styles: string[] | null
}

const mapProfileRow = (row: ProfileRow | null): UserStyleProfile => {
  if (!row) {
    return {}
  }
  return {
    gender: row.gender ?? undefined,
    age: row.age ?? undefined,
    favoriteColors: row.favorite_colors ?? undefined,
    dislikedColors: row.disliked_colors ?? undefined,
    stylePreferences: row.favorite_styles ?? undefined,
  }
}

export async function fetchUserStyleProfile(userId: string): Promise<UserStyleProfile> {
  const client = createServiceClient()
  try {
    const { data, error } = await client
      .from('profiles')
      .select('gender, age, favorite_colors, disliked_colors, favorite_styles')
      .eq('id', userId)
      .maybeSingle<ProfileRow>()

    if (error) {
      console.warn('[userProfile] Failed to fetch profile', error)
      return {}
    }
    return mapProfileRow(data ?? null)
  } catch (error) {
    console.warn('[userProfile] Unexpected error fetching profile', error)
    return {}
  }
}

