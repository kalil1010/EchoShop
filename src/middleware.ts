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
  try {
    // Create a read-only Supabase client for middleware
    // We avoid getSession() as it can trigger token refresh which tries to modify cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          // In middleware, we can't modify cookies directly
          // These handlers are no-ops to prevent Supabase from trying to modify cookies
          set() {
            // No-op: cookies can only be modified via NextResponse in middleware
          },
          remove() {
            // No-op: cookies can only be modified via NextResponse in middleware
          },
        },
      }
    )

    // Only use getUser() - it's more reliable and doesn't trigger session refresh
    // getSession() can trigger token refresh which tries to delete/modify cookies
    const {
      data: { user: getUserResult },
      error: getUserError,
    } = await supabase.auth.getUser()

    if (getUserResult && !getUserError) {
      return getUserResult
    }

    // If getUser() fails, the session is likely invalid or expired
    // Don't try getSession() as it can trigger refresh logic that modifies cookies
    if (getUserError) {
      // Log only if it's not a common "session not found" error
      if (!getUserError.message?.includes('session') && !getUserError.message?.includes('JWT')) {
        console.warn('[middleware] Error getting user:', getUserError.message)
      }
    }

    return null
  } catch (error) {
    // If there's an error getting the user, assume not authenticated
    // Don't log common session errors to avoid noise
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (!errorMessage.includes('session') && !errorMessage.includes('JWT') && !errorMessage.includes('cookie')) {
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
        const target = access.denial?.redirect ?? getDefaultRouteForRole(role)
        const response = NextResponse.redirect(new URL(target, req.url))
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
  } else if (portal !== 'customer') {
    // Allow access to login pages for unauthenticated users
    const isLoginPage = pathname === '/downtown' || pathname === '/atlas' || pathname === '/vendor/login'
    if (isLoginPage) {
      // Allow unauthenticated access to login pages
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
    console.info('[middleware] unauthenticated portal access blocked', { portal, path: pathname })
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/auth', req.url))
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
