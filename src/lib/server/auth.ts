import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
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
  const routeClient = createRouteHandlerClient({ cookies })
  
  let sessionData: { session: any } | null = null
  let sessionError: any = null
  
  try {
    const result = await routeClient.auth.getSession()
    sessionData = result.data
    sessionError = result.error
  } catch (error) {
    // CRITICAL: Catch and suppress refresh token errors that might be thrown as exceptions
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string })?.code
    const isRefreshTokenError = 
      errorCode === 'refresh_token_not_found' ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found') ||
      (error && typeof error === 'object' && '__isAuthError' in error && errorCode === 'refresh_token_not_found')
    
    if (isRefreshTokenError) {
      // Refresh token expired - user is not authenticated
      throw new PermissionError('auth', 'You must be logged in to continue.')
    }
    
    // Re-throw non-refresh-token errors
    throw error
  }
  
  // Check if this is a refresh token error - handle gracefully
  if (sessionError) {
    const errorCode = (sessionError as { code?: string })?.code
    const errorMessage = sessionError.message || String(sessionError)
    const isRefreshTokenError = 
      errorCode === 'refresh_token_not_found' ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found')
    
    // If refresh token is invalid, user is not authenticated
    if (isRefreshTokenError) {
      throw new PermissionError('auth', 'You must be logged in to continue.')
    }
    
    // For other errors, throw as well
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }
  
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
