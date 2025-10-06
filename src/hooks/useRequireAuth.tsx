'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'

interface UseRequireAuthOptions {
  redirectTo?: string
}

interface UseRequireAuthResult {
  user: ReturnType<typeof useAuth>['user']
  loading: boolean
  isAuthenticated: boolean
}

export function useRequireAuth(options?: UseRequireAuthOptions): UseRequireAuthResult {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)

  useEffect(() => {
    if (loading || user || redirected.current) {
      return
    }
    const target = options?.redirectTo ?? `/auth?redirect=${encodeURIComponent(pathname || '/')}`
    redirected.current = true
    try {
      router.replace(target)
    } catch (error) {
      console.warn('Failed to redirect unauthenticated user:', error)
      redirected.current = false
    }
  }, [loading, options?.redirectTo, pathname, router, user])

  return { user, loading, isAuthenticated: !!user }
}
