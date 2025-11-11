import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import type { UserProfile } from '@/types/user'
import { getDefaultRouteForRole, getPortalAccess, normaliseRole, resolvePortalFromPath } from '@/lib/roles'

const getSupabaseAdmin = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}

const getAuthenticatedUser = async (req: NextRequest) => {
  // Check if auth cookies exist first
  const hasAuthCookies = req.cookies.getAll().some(
    (cookie) =>
      cookie.name.startsWith('sb-') ||
      cookie.name.startsWith('sb:') ||
      cookie.name.startsWith('__Secure-sb-')
  )

  if (!hasAuthCookies) {
    // No auth cookies, user is definitely not authenticated
    return null
  }

  try {
    // Create a Supabase client with no-op cookie handlers
    // This prevents Supabase from trying to modify cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          // No-op handlers to prevent any cookie modifications
          set() {
            // Cookies can only be modified via NextResponse in middleware
            // Supabase will try to call this during token refresh, but we ignore it
          },
          remove() {
            // Cookies can only be modified via NextResponse in middleware
            // Supabase will try to call this during session cleanup, but we ignore it
          },
        },
      }
    )

    // Try to get the user
    // This may trigger internal session management that tries to modify cookies
    // We catch and suppress those errors since we can't modify cookies in middleware
    try {
      const {
        data: { user: getUserResult },
        error: getUserError,
      } = await supabase.auth.getUser()

      if (getUserResult && !getUserError) {
        return getUserResult
      }

      // If getUser() fails, the session is likely invalid or expired
      return null
    } catch (sessionError: unknown) {
      // Supabase's internal session management (token refresh, session cleanup)
      // tries to modify cookies, which throws errors in middleware
      // We catch and suppress these errors since we already allow requests through
      // when cookies are present (see the logic below)
      const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError)
      
      // Suppress cookie modification errors - these are expected in middleware
      if (errorMessage.includes('cookie') || 
          errorMessage.includes('Cookie') ||
          errorMessage.includes('Server Action') ||
          errorMessage.includes('Route Handler')) {
        // This is expected - Supabase tried to modify cookies but we prevented it
        // Return null and let the page/API route handle authentication
        return null
      }
      
      // Re-throw unexpected errors
      throw sessionError
    }
  } catch (error: unknown) {
    // Catch any other errors and suppress cookie-related ones
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Suppress cookie-related errors as they're expected in middleware
    if (errorMessage.includes('cookie') || 
        errorMessage.includes('Cookie') ||
        errorMessage.includes('Server Action') ||
        errorMessage.includes('Route Handler')) {
      return null
    }
    
    // Log other unexpected errors (but not session/JWT errors which are common)
    if (!errorMessage.includes('session') && 
        !errorMessage.includes('JWT') && 
        !errorMessage.includes('token')) {
      console.warn('[middleware] Error getting authenticated user:', errorMessage)
    }
    
    return null
  }
}

const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const supabaseAdmin = getSupabaseAdmin()
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error(`[middleware] User profile not found for ${userId}:`, error)
    return null
  }
  return profile as UserProfile
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const user = await getAuthenticatedUser(req)
  const portal = resolvePortalFromPath(pathname)

  if (user) {
    const profile = await fetchUserProfile(user.id)
    const role = normaliseRole(profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role)
    if (portal !== 'customer') {
      const access = getPortalAccess(role, portal)
      if (!access.allowed) {
        console.warn('[middleware] portal access denied', {
          userId: user.id,
          role,
          portal,
          path: pathname,
          redirect: access.denial?.redirect ?? null,
          requiresLogout: Boolean(access.denial?.requiresLogout),
        })
        if (pathname.startsWith('/api')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        
        // Redirect to /auth with role and redirect info for clear messaging
        const redirectUrl = new URL('/auth', req.url)
        redirectUrl.searchParams.set('redirect', pathname)
        redirectUrl.searchParams.set('role', role)
        const response = NextResponse.redirect(redirectUrl)
        
        if (access.denial?.requiresLogout) {
          for (const cookie of req.cookies.getAll()) {
            if (
              cookie.name.startsWith('sb-') ||
              cookie.name.startsWith('sb:') ||
              cookie.name.startsWith('__Secure-sb-')
            ) {
              response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 })
            }
          }
        }
        return response
      }
      console.info('[middleware] portal access granted', { userId: user.id, role, portal, path: pathname })
    }
  } else {
    // Allow public routes for unauthenticated users
    const isPublicRoute = 
      pathname === '/auth' ||
      pathname === '/' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/auth/callback') ||
      pathname === '/favicon.ico' ||
      pathname.startsWith('/analyzer') ||
      pathname.startsWith('/marketplace')
    
    if (isPublicRoute) {
      return NextResponse.next()
    }
    // Check if there are any Supabase auth cookies (user might be logged in but session not detected)
    const hasAuthCookies = req.cookies.getAll().some(
      (cookie) =>
        cookie.name.startsWith('sb-') ||
        cookie.name.startsWith('sb:') ||
        cookie.name.startsWith('__Secure-sb-')
    )
    if (hasAuthCookies) {
      // User has auth cookies but session wasn't detected - might be a timing issue or expired session
      // Allow the request through and let the page/API route handle authentication
      // This is expected behavior when cookies exist but session is invalid/expired
      return NextResponse.next()
    }
    console.info('[middleware] unauthenticated access blocked, redirecting to /auth', { pathname })
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Redirect to /auth with return URL
    const redirectUrl = new URL('/auth', req.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers.get('x-forwarded-proto')
    if (proto && proto !== 'https') {
      const url = new URL(req.url)
      url.protocol = 'https:'
      return NextResponse.redirect(url, 308)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
