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
  const authCookies = req.cookies.getAll().filter(
    (cookie) =>
      cookie.name.startsWith('sb-') ||
      cookie.name.startsWith('sb:') ||
      cookie.name.startsWith('__Secure-sb-')
  )
  
  const hasAuthCookies = authCookies.length > 0

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
    let refreshTokenError = false
    try {
      const {
        data: { user: getUserResult },
        error: getUserError,
      } = await supabase.auth.getUser()

      // Check if the error is a refresh token error
      if (getUserError) {
        const errorCode = (getUserError as { code?: string })?.code
        const errorMessage = getUserError.message || String(getUserError)
        
        // Refresh token errors indicate the session is invalid/expired
        if (errorCode === 'refresh_token_not_found' || 
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('refresh_token_not_found')) {
          refreshTokenError = true
          // Session is invalid - cookies are stale
          return null
        }
      }

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
      const errorCode = (sessionError as { code?: string })?.code || ''
      
      // Suppress refresh token errors - these indicate invalid/expired sessions
      if (errorCode === 'refresh_token_not_found' ||
          errorMessage.includes('Refresh Token Not Found') ||
          errorMessage.includes('refresh_token_not_found')) {
        refreshTokenError = true
        // Session is invalid - return null to allow client-side cleanup
        return null
      }
      
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
    const errorCode = (error as { code?: string })?.code || ''
    
    // Suppress refresh token errors - these indicate invalid/expired sessions
    if (errorCode === 'refresh_token_not_found' ||
        errorMessage.includes('Refresh Token Not Found') ||
        errorMessage.includes('refresh_token_not_found')) {
      // Session is invalid - return null to allow client-side cleanup
      return null
    }
    
    // Suppress cookie-related errors as they're expected in middleware
    if (errorMessage.includes('cookie') || 
        errorMessage.includes('Cookie') ||
        errorMessage.includes('Server Action') ||
        errorMessage.includes('Route Handler')) {
      return null
    }
    
    // Log other unexpected errors (but not session/JWT/token errors which are common)
    if (!errorMessage.includes('session') && 
        !errorMessage.includes('JWT') && 
        !errorMessage.includes('token') &&
        !errorMessage.includes('Refresh Token')) {
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

// Common vulnerability scanning patterns - return 404 instead of redirecting
const isAttackPattern = (pathname: string): boolean => {
  const attackPatterns = [
    /\.env/i,                    // Environment files
    /\.env\.(bak|old|save|backup|orig|swp|tmp|~)/i,
    /phpinfo/i,                  // PHP info files
    /php_info/i,
    /php\.php/i,
    /info\.php/i,
    /test\.php/i,
    /debug\.php/i,
    /server\.php/i,
    /check\.php/i,
    /diagnostic\.php/i,
    /\.git/i,                    // Git files
    /\.git\/config/i,
    /wp-admin/i,                 // WordPress
    /wp-login/i,
    /wp-content/i,
    /administrator/i,            // Common CMS paths
    /admin\.php/i,
    /\.sql/i,                    // Database files
    /\.bak/i,
    /\.old/i,
    /\.save/i,
    /\.backup/i,
    /\.orig/i,
    /\.swp/i,
    /\.tmp/i,
    /\.~$/i,
    /\/_profiler\//i,            // Symfony profiler
    /\/storage\/\.env/i,
    /\/vendor\/\.env/i,
    /\/themes\/\.env/i,
    /\/plugins\/\.env/i,
  ]
  
  return attackPatterns.some(pattern => pattern.test(pathname))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const user = await getAuthenticatedUser(req)
  const portal = resolvePortalFromPath(pathname)
  
  // Track if we detected stale cookies (for cookie cleanup)
  const authCookies = req.cookies.getAll().filter(
    (cookie) =>
      cookie.name.startsWith('sb-') ||
      cookie.name.startsWith('sb:') ||
      cookie.name.startsWith('__Secure-sb-')
  )
  const hasStaleCookies = authCookies.length > 0 && !user

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
      pathname.startsWith('/auth/') || // Allow all /auth/* routes including /auth/callback
      pathname === '/' ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/auth/callback') ||
      pathname === '/favicon.ico' ||
      pathname.startsWith('/analyzer') ||
      pathname.startsWith('/marketplace') ||
      pathname === '/about' ||
      pathname === '/help' ||
      pathname === '/terms' ||
      pathname === '/privacy' ||
      pathname === '/vendor/login' ||
      pathname === '/downtown' || // Allow /downtown (login page) for unauthenticated users
      // Public API routes that don't require authentication
      pathname.startsWith('/api/help') ||
      pathname.startsWith('/api/feedback') ||
      pathname.startsWith('/api/user-tour') ||
      pathname.startsWith('/api/local-arrivals')
    
    if (isPublicRoute) {
      return NextResponse.next()
    }
    
    // For API routes, always allow them through - they use createRouteHandlerClient
    // which can properly handle cookies and validate sessions server-side
    // The API routes will return 401 if the session is truly invalid
    // This prevents middleware from blocking valid requests due to cookie detection issues
    if (pathname.startsWith('/api/')) {
      return NextResponse.next()
    }
    
    // Handle stale cookies (cookies exist but session is invalid)
    // This happens when:
    // 1. Refresh token is invalid/expired (cookies exist but session is invalid)
    // 2. Session restoration from localStorage hasn't completed yet (timing issue)
    if (hasStaleCookies) {
      // For page routes, allow through once for client-side session restoration
      // Client-side will detect invalid tokens and clear cookies via /api/auth/callback
      // If cookies are truly stale, the client will clear them and redirect to login
      return NextResponse.next()
    }
    
    // Check if this is an obvious attack pattern (vulnerability scanning)
    if (isAttackPattern(pathname)) {
      // Return 404 for attack patterns instead of redirecting
      // This reduces log noise and doesn't give attackers information
      return new NextResponse(null, { status: 404 })
    }
    
    // Only log legitimate routes that need authentication
    // Skip logging for favicon requests and other common non-attack patterns
    const shouldLog = !pathname.includes('favicon.ico') && 
                      !pathname.includes('.ico') &&
                      !pathname.includes('.png') &&
                      !pathname.includes('.jpg') &&
                      !pathname.includes('.svg')
    
    if (shouldLog) {
      console.info('[middleware] unauthenticated access blocked, redirecting to /auth', { pathname })
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
