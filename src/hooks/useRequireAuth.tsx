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
  const { user, loading, session } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Store latest auth state in refs for timeout callback
  const userRef = useRef(user)
  const sessionRef = useRef(session)
  const loadingRef = useRef(loading)

  // Keep refs in sync with current values
  useEffect(() => {
    userRef.current = user
    sessionRef.current = session
    loadingRef.current = loading
  }, [user, session, loading])

  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Reset redirected flag if user becomes available
    if (user || session) {
      redirected.current = false
      return
    }

    // If still loading, don't redirect yet
    if (loading || redirected.current) {
      return
    }

    // On mobile devices (especially iPad Safari), session initialization can take longer
    // Wait a bit before redirecting to allow session to initialize from cookies
    // This helps with slower cookie/session initialization on mobile browsers
    timeoutRef.current = setTimeout(() => {
      // Re-check current auth state using refs (they're always up-to-date)
      if (userRef.current || sessionRef.current || loadingRef.current || redirected.current) {
        redirected.current = false
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
    }, 1000) // Wait 1 second for session to initialize on mobile devices

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [loading, options?.redirectTo, pathname, router, user, session])

  return { user, loading, isAuthenticated: !!user }
}
