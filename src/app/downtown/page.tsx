import { redirect } from 'next/navigation'

import { OwnerLoginForm } from '@/components/owner/OwnerLoginForm'
import { createRouteClient } from '@/lib/supabaseServer'
import { getDefaultRouteForRole, normaliseRole } from '@/lib/roles'

export const metadata = {
  title: 'Echo Shop Downtown Entry',
  description: 'Secure access for verified Echo Shop owners.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DowntownEntryPage() {
  try {
    const supabase = createRouteClient()
    let user = null
    let authError = null

    try {
      const result = await supabase.auth.getUser()
      user = result.data?.user ?? null
      authError = result.error
    } catch (error: unknown) {
      // Supabase may try to refresh tokens which attempts to modify cookies
      // This is not allowed in server components, but it's not harmful
      // Check if it's a cookie modification error or refresh token error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = (error as { code?: string })?.code || ''
      const isCookieError = 
        errorMessage.includes('Cookies can only be modified') ||
        errorMessage.includes('Server Action') ||
        errorMessage.includes('Route Handler')
      const isRefreshTokenError = 
        errorCode === 'refresh_token_not_found' ||
        errorMessage.includes('Refresh Token Not Found') ||
        errorMessage.includes('refresh_token_not_found')
      
      if (isCookieError || isRefreshTokenError) {
        // This is expected - Supabase tried to manage sessions but can't modify cookies
        // or refresh token is invalid/expired
        // Try to get user from session instead (read-only)
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
          // If session error is also a refresh token error, user is not authenticated
          if (sessionError) {
            const sessionErrorCode = (sessionError as { code?: string })?.code
            const sessionErrorMessage = sessionError.message || String(sessionError)
            const isSessionRefreshTokenError = 
              sessionErrorCode === 'refresh_token_not_found' ||
              sessionErrorMessage.includes('Refresh Token Not Found') ||
              sessionErrorMessage.includes('refresh_token_not_found')
            if (!isSessionRefreshTokenError) {
              // Only use session if error is not a refresh token error
              user = sessionData?.session?.user ?? null
            }
          } else {
            user = sessionData?.session?.user ?? null
          }
        } catch {
          // If that also fails, user is not authenticated
          user = null
        }
      } else {
        // Real error, log it
        console.warn('[downtown] Auth error:', error)
        authError = error as Error
      }
    }

    // If there's an auth error or no user, show login form
    if (authError || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
          <OwnerLoginForm />
        </div>
      )
    }

    // User exists, try to get their profile
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: string | null }>()

      // If profile exists and has a role, check if it's owner
      if (!profileError && profile?.role) {
        const role = normaliseRole(profile.role)
        if (role === 'owner') {
          // Owner role - redirect to owner dashboard
          redirect('/downtown/dashboard')
        } else {
          // Wrong role - redirect to /auth with message
          redirect(`/auth?redirect=/downtown&role=${role}`)
        }
      }
      // If no profile or error, redirect to /auth to create profile
      if (!profileError && !profile) {
        redirect('/auth?redirect=/downtown&missingProfile=true')
      }
    } catch (profileError: unknown) {
      // Check if this is a Next.js redirect (expected behavior, not an error)
      if (
        profileError &&
        typeof profileError === 'object' &&
        'digest' in profileError &&
        typeof profileError.digest === 'string' &&
        profileError.digest.startsWith('NEXT_REDIRECT')
      ) {
        // This is a Next.js redirect, re-throw it to let Next.js handle it
        throw profileError
      }
      // Profile query failed, show login form
      console.error('[downtown] Profile query error:', profileError)
    }
  } catch (error: unknown) {
    // Check if this is a Next.js redirect (expected behavior, not an error)
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      // This is a Next.js redirect, re-throw it to let Next.js handle it
      throw error
    }
    
    // Check if it's a cookie modification error or refresh token error (expected in server components)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string })?.code || ''
    const isCookieError = 
      errorMessage.includes('Cookies can only be modified') ||
      errorMessage.includes('Server Action') ||
      errorMessage.includes('Route Handler')
    const isRefreshTokenError = 
      errorCode === 'refresh_token_not_found' ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found')
    
    if (isCookieError || isRefreshTokenError) {
      // This is expected - Supabase tried to manage sessions but can't modify cookies in server components
      // or refresh token is invalid/expired
      // Not harmful, just show login form
      // Don't log as error since it's expected behavior
    } else {
      // Real error, log it
      console.error('[downtown] Page error:', error)
    }
  }

  // Default: redirect to unified login
  redirect('/auth?redirect=/downtown')
}
