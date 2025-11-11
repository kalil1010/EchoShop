'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole } from '@/lib/roles'

const isDowntownPath = (pathname: string | null) => {
  if (!pathname) return false
  return pathname === '/downtown' || pathname.startsWith('/downtown/')
}

export function OwnerPortalRedirect() {
  const { role, loading, profileStatus, user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Don't redirect if auth is loading or if user is not logged in
    // This prevents redirects during logout when user becomes null
    if (loading) return
    if (!user) return
    if (role !== 'owner') return
    if (isDowntownPath(pathname)) return

    // Avoid interrupting profile bootstrap while still keeping owners out of the main surface.
    if (profileStatus === 'loading' && typeof window !== 'undefined') {
      return
    }

    router.replace(getDefaultRouteForRole(role))
  }, [loading, role, profileStatus, pathname, router, user])

  return null
}
