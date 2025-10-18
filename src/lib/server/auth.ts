import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { createRouteClient } from '@/lib/supabaseServer'
import { requireSessionUser } from '@/lib/security'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const extractBearerToken = (headerValue?: string | null): string | null => {
  if (!headerValue) return null
  const match = headerValue.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export async function resolveAuthenticatedUser(
  request: NextRequest,
): Promise<{ userId: string; accessToken?: string }> {
  const supabase = createRouteClient()
  try {
    const userId = await requireSessionUser(supabase)
    return { userId }
  } catch (primaryError) {
    const token = extractBearerToken(request.headers.get('authorization'))
    if (!token) throw primaryError
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw primaryError
    }
    const fallbackClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    if (!fallbackClient) throw primaryError
    const { data, error } = await fallbackClient.auth.getUser(token)
    if (error || !data?.user) {
      throw primaryError
    }
    return { userId: data.user.id, accessToken: token }
  }
}
