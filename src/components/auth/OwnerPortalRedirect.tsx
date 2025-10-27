'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'

const isDowntownPath = (pathname: string | null) => {
  if (!pathname) return false
  return pathname === '/downtown' || pathname.startsWith('/downtown/')
}

export function OwnerPortalRedirect() {
  const { user, userProfile, loading, profileStatus } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    const role = userProfile?.role ?? user?.role ?? null
    if (role !== 'owner') return
    if (isDowntownPath(pathname)) return

    // Avoid interrupting profile bootstrap while still keeping owners out of the main surface.
    if (profileStatus === 'loading' && typeof window !== 'undefined') {
      return
    }

    router.replace('/downtown')
  }, [loading, user?.role, userProfile?.role, profileStatus, pathname, router])

  return null
}

