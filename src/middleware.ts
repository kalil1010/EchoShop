import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

import type { UserProfile } from '@/types/user'

const getSupabaseAdmin = () => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll(_cookiesToSet) {},
      },
    }
  )
}

const getAuthenticatedUser = async (req: NextRequest) => {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          req.cookies.set({ name, value, ...options })
        },
        remove(name: string, options) {
          req.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.user ?? null
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

  // Role-based route protection
  if (user) {
    const profile = await fetchUserProfile(user.id)
    const role = profile?.role?.toLowerCase()
    const isOwner = role === 'owner'

    if (isOwner) {
      const inDowntown = pathname === '/downtown' || pathname.startsWith('/downtown/')
      const isApiRequest = pathname.startsWith('/api')

      if (!inDowntown && !isApiRequest) {
        if (pathname !== '/downtown') {
          console.info(
            `[middleware] Owner ${user.id} requested ${pathname}. Redirecting to /downtown.`,
          )
        }
        return NextResponse.redirect(new URL('/downtown', req.url))
      }
    }

    if (pathname.startsWith('/downtown')) {
      if (!isOwner) {
        console.warn(
          `[middleware] Redirecting non-owner user ${user.id} away from ${pathname}. role=${role ?? 'unknown'}`,
        )
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    if (pathname.startsWith('/atlas')) {
      if (role !== 'vendor' || !profile?.vendorApprovedAt) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    if (pathname.startsWith('/api/admin')) {
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (pathname.startsWith('/api/vendor')) {
      if (role !== 'vendor') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

  } else {
    // Redirect unauthenticated users trying to access protected routes
    if (pathname.startsWith('/downtown') || pathname.startsWith('/atlas') || pathname.startsWith('/api/admin') || pathname.startsWith('/api/vendor')) {
      return NextResponse.redirect(new URL('/auth', req.url))
    }
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
