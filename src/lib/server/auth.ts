import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies as nextCookies } from 'next/headers'
import { PermissionError } from '@/lib/security'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const extractBearerToken = (headerValue?: string | null): string | null => {
  if (!headerValue) return null
  const match = headerValue.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export async function resolveAuthenticatedUser(
  request: NextRequest,
): Promise<{ userId: string; accessToken: string }> {
  const routeClient = createRouteHandlerClient({
    cookies: () => request.cookies as unknown as ReturnType<typeof nextCookies>,
  })
  const { data: sessionData } = await routeClient.auth.getSession()
  const session = sessionData?.session
  if (session?.user) {
    const token = session.access_token ?? ''
    if (!token) {
      throw new PermissionError('auth', 'You must be logged in to continue.')
    }
    return { userId: session.user.id, accessToken: token }
  }

  const token = extractBearerToken(request.headers.get('authorization'))
  if (!token) {
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment configuration.')
  }

  const fallbackClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await fallbackClient.auth.getUser(token)
  if (error || !data?.user) {
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }
  return { userId: data.user.id, accessToken: token }
}
