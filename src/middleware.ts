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
  // Supabase SSR uses various cookie name patterns
  const authCookies = req.cookies.getAll().filter(
    (cookie) => {
      const name = cookie.name.toLowerCase()
      return (
        name.startsWith('sb-') ||
        name.startsWith('sb:') ||
        name.startsWith('__secure-sb-') ||
        name.includes('supabase') ||
        name.includes('auth-token') ||
        name.includes('access-token') ||
        name.includes('refresh-token')
      )
    }
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

    // Try to get the session (more reliable than getUser() for middleware)
    // getSession() reads directly from cookies and doesn't require token validation
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      // If we have a valid session with a user, return the user
      if (session?.user && !sessionError) {
        return session.user
      }

      // Check if the error is a refresh token error
      if (sessionError) {
        const errorCode = (sessionError as { code?: string })?.code
        const errorMessage = sessionError.message || String(sessionError)
        
        // When refresh token is invalid/expired, cookies are stale
        // Return null to allow stale cookie handling below
        // CRITICAL: Don't log these errors - they're expected when tokens expire
        if (errorCode === 'refresh_token_not_found' || 
            errorCode === 400 && errorMessage.includes('Refresh Token') ||
            errorMessage.includes('Refresh Token Not Found') ||
            errorMessage.includes('refresh_token_not_found') ||
            (sessionError && typeof sessionError === 'object' && '__isAuthError' in sessionError && errorCode === 'refresh_token_not_found')) {
          // Cookies exist but session invalid - return null to allow client-side recovery
          // No logging - this is expected behavior
          return null
        }
      }

      // If getSession() fails but cookies exist, the session might be restoring
      // Return null to allow stale cookie handling below
      // This allows client-side session restoration to proceed from cache
      return null
    } catch (sessionError: unknown) {
      // Supabase's internal session management (token refresh, session cleanup)
      // tries to modify cookies, which throws errors in middleware
      // We catch and suppress these errors since we already allow requests through
      // when cookies are present (see the logic below)
      const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError)
      const errorCode = (sessionError as { code?: string })?.code || ''
      
      // Check if this is a refresh token error (can be thrown as exception)
      const isRefreshTokenError = 
        errorCode === 'refresh_token_not_found' ||
        errorMessage.includes('Refresh Token Not Found') ||
        errorMessage.includes('refresh_token_not_found') ||
        (sessionError && typeof sessionError === 'object' && '__isAuthError' in sessionError && errorCode === 'refresh_token_not_found')
      
      // Suppress refresh token errors - these indicate invalid/expired sessions
      if (isRefreshTokenError) {
        // Session is invalid - return null to allow stale cookie handling
        // Client-side will detect and clean up
        return null
      }
      
      // Suppress cookie modification errors - these are expected in middleware
      // These happen when Supabase tries to refresh tokens but can't modify cookies
      if (errorMessage.includes('cookie') || 
          errorMessage.includes('Cookie') ||
          errorMessage.includes('Server Action') ||
          errorMessage.includes('Route Handler')) {
        // This is expected - Supabase tried to modify cookies but we prevented it
        // Return null to allow stale cookie handling - client will restore from localStorage
        return null
      }
      
      // For other errors, suppress them silently - client-side will handle validation
      return null
    }
  } catch (error: unknown) {
    // Catch any other errors and suppress cookie-related ones
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { code?: string })?.code || ''
    
    // Check if this is a refresh token error (can be thrown as exception)
    const isRefreshTokenError = 
      errorCode === 'refresh_token_not_found' ||
      errorMessage.includes('Refresh Token Not Found') ||
      errorMessage.includes('refresh_token_not_found') ||
      (error && typeof error === 'object' && '__isAuthError' in error && errorCode === 'refresh_token_not_found')
    
    // Suppress refresh token errors - these indicate invalid/expired sessions
    if (isRefreshTokenError) {
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
    
    // Suppress all auth/session/token errors silently - they're expected
    if (errorMessage.includes('session') || 
        errorMessage.includes('JWT') || 
        errorMessage.includes('token') ||
        errorMessage.includes('Refresh Token') ||
        errorMessage.includes('auth')) {
      return null
    }
    
    // Only log truly unexpected errors (not auth-related)
    console.warn('[middleware] Unexpected error getting authenticated user:', errorMessage)
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
  // Check for any Supabase auth-related cookies
  const authCookies = req.cookies.getAll().filter(
    (cookie) => {
      const name = cookie.name.toLowerCase()
      return (
        name.startsWith('sb-') ||
        name.startsWith('sb:') ||
        name.startsWith('__secure-sb-') ||
        name.includes('supabase') ||
        name.includes('auth-token') ||
        name.includes('access-token') ||
        name.includes('refresh-token')
      )
    }
  )
  const hasStaleCookies = authCookies.length > 0 && !user
  
  // Skip middleware for static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

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
            const name = cookie.name.toLowerCase()
            if (
              name.startsWith('sb-') ||
              name.startsWith('sb:') ||
              name.startsWith('__secure-sb-') ||
              name.includes('supabase') ||
              name.includes('auth-token') ||
              name.includes('access-token') ||
              name.includes('refresh-token')
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
    
    // CRITICAL FIX: Handle stale cookies (cookies exist but session is invalid)
    // This happens when:
    // 1. Refresh token is invalid/expired (cookies exist but session is invalid)
    // 2. Session restoration from sessionStorage cache hasn't completed yet (timing issue)
    // 3. User just refreshed the page and session is being restored
    // ALWAYS allow through when cookies exist, even if middleware can't validate session
    // This gives AuthContext time to restore from sessionStorage cache before
    // making redirect decisions. The client-side will handle validation and cleanup.
    if (hasStaleCookies) {
      // For page routes, always allow through for client-side session restoration
      // The client-side AuthContext will:
      // - Check sessionStorage cache FIRST (instant restoration on refresh)
      // - Restore session from cache if valid (TTL < 5 minutes)
      // - Validate the session with Supabase in background (with timeout)
      // - Clear stale cookies and redirect to login only if truly invalid
      // This prevents the infinite loading bug where middleware blocks valid users
      // Only log in development to reduce noise in production
      if (process.env.NODE_ENV === 'development') {
        console.debug('[middleware] Stale cookies detected, allowing through for client-side recovery', { pathname })
      }
      
      // IMPROVEMENT: Don't clear cookies immediately - let client-side decide
      // Clearing cookies here can interfere with ongoing session restoration
      // Client-side will clear them if session is truly invalid
      // This gives AuthContext more time to restore from cache
      return NextResponse.next()
    }
    
    // Check if this is an obvious attack pattern (vulnerability scanning)
    if (isAttackPattern(pathname)) {
      // Return 404 for attack patterns instead of redirecting
      // This reduces log noise and doesn't give attackers information
      return new NextResponse(null, { status: 404 })
    }
    
    // For page routes (not API), be lenient and allow through
    // The client-side will handle authentication and redirect if needed
    // This prevents blocking users who have sessions in localStorage but no cookies yet
    // API routes are handled separately above and will return 401 if truly unauthenticated
    if (!pathname.startsWith('/api/')) {
      // Allow page routes through - client-side will handle auth
      // This is safe because:
      // 1. Client-side AuthContext validates sessions
      // 2. Protected pages use useRequireAuth hook
      // 3. API routes still require proper authentication
      return NextResponse.next()
    }
    
    // Only log API routes that are truly unauthenticated
    // Skip logging for static assets, favicon, and image requests
    const shouldLog = 
      !pathname.includes('favicon.ico') && 
      !pathname.includes('.ico') &&
      !pathname.includes('.png') &&
      !pathname.includes('.jpg') &&
      !pathname.includes('.jpeg') &&
      !pathname.includes('.svg') &&
      !pathname.includes('.gif') &&
      !pathname.includes('.webp') &&
      !pathname.includes('.css') &&
      !pathname.includes('.js') &&
      !pathname.includes('.woff') &&
      !pathname.includes('.woff2')
    
    if (shouldLog) {
      console.info('[middleware] unauthenticated API access blocked', { pathname })
    }
    
    // For API routes, return 401 instead of redirecting
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
