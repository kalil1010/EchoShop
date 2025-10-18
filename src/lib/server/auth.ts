import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { createRouteClient } from '@/lib/supabaseServer'
import { requireSessionUser } from '@/lib/security'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let anonClient: SupabaseClient | null = null

const extractBearerToken = (headerValue?: string | null): string | null => {
  if (!headerValue) return null
  const match = headerValue.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

const getAnonClient = (): SupabaseClient | null => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('[auth] Missing Supabase environment variables for token verification.')
    return null
  }
  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return anonClient
}

export async function resolveAuthenticatedUser(
  request: NextRequest,
): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createRouteClient()
  try {
    const userId = await requireSessionUser(supabase)
    return { supabase, userId }
  } catch (primaryError) {
    const token = extractBearerToken(request.headers.get('authorization'))
    if (!token) throw primaryError
    const fallbackClient = getAnonClient()
    if (!fallbackClient) throw primaryError
    const { data, error } = await fallbackClient.auth.getUser(token)
    if (error || !data?.user) {
      throw primaryError
    }
    return { supabase, userId: data.user.id }
  }
}
