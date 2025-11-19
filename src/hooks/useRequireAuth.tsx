'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import { readSessionCache } from '@/lib/sessionCache'

interface UseRequireAuthOptions {
  redirectTo?: string
}

interface UseRequireAuthResult {
  user: ReturnType<typeof useAuth>['user']
  loading: boolean
  isAuthenticated: boolean
}

export function useRequireAuth(options?: UseRequireAuthOptions): UseRequireAuthResult {
  const { user, loading, session, profileStatus } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const redirected = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const cacheCheckedRef = useRef(false)
  const [optimisticUser, setOptimisticUser] = useState<typeof user>(null)
  const [optimisticLoading, setOptimisticLoading] = useState(true)
  
  // Store latest auth state in refs for timeout callback
  const userRef = useRef(user)
  const sessionRef = useRef(session)
  const loadingRef = useRef(loading)
  const profileStatusRef = useRef(profileStatus)

  // Keep refs in sync with current values
  useEffect(() => {
    userRef.current = user
    sessionRef.current = session
    loadingRef.current = loading
    profileStatusRef.current = profileStatus
  }, [user, session, loading, profileStatus])
  
  // CRITICAL FIX: Check cache FIRST on mount to enable optimistic rendering
  // This prevents the infinite loading state on refresh
  useEffect(() => {
    if (cacheCheckedRef.current) return
    cacheCheckedRef.current = true

    const cached = readSessionCache()
    if (cached) {
      console.debug('[useRequireAuth] Cache shows user, enabling optimistic rendering')
      setOptimisticUser(cached.user)
      setOptimisticLoading(false)
      return
    }

    if (typeof window === 'undefined') return

    try {
      // Check localStorage for auth tokens (backup check)
      const hasAuthStorage = Object.keys(localStorage).some((key) =>
        key.includes('supabase.auth') || key.includes('sb-'),
      )

      if (hasAuthStorage) {
        // Auth storage exists - user likely authenticated, just waiting for restoration
        console.debug('[useRequireAuth] Auth storage found, waiting for restoration')
        setOptimisticLoading(true)
      } else {
        setOptimisticLoading(false)
      }
    } catch {
      setOptimisticLoading(loading)
    }
  }, [loading])
  
  // Update optimistic state when real auth state resolves
  // Also reset when profileStatus finishes loading (even if it failed)
  useEffect(() => {
    if (!loading && user) {
      setOptimisticUser(user)
      // Only set optimisticLoading to false if profileStatus is also done
      if (profileStatus !== 'loading') {
        setOptimisticLoading(false)
      }
    } else if (!loading && !user) {
      setOptimisticUser(null)
      setOptimisticLoading(false)
    }
  }, [loading, user, profileStatus])
  
  // Reset optimisticLoading when profileStatus finishes (ready, error, or degraded)
  useEffect(() => {
    if (profileStatus !== 'loading' && profileStatus !== 'idle') {
      // Profile status is resolved (ready, error, or degraded) - safe to stop optimistic loading
      setOptimisticLoading(false)
    }
  }, [profileStatus])

  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Use optimistic user if available, otherwise use real user
    const currentUser = user || optimisticUser
    // Wait for both loading AND profile status (like vendor/owner dashboards)
    const currentLoading = (loading || profileStatus === 'loading') && optimisticLoading

    // Reset redirected flag if user becomes available
    if (currentUser || session) {
      redirected.current = false
      return
    }

    // If still loading optimistically, don't redirect yet (give it time)
    if (currentLoading && optimisticUser) {
      // Have optimistic user but still loading - wait a bit more
      return
    }

    // If still loading, don't redirect yet
    if (currentLoading || redirected.current) {
      return
    }

    // CRITICAL FIX: Add timeout to prevent infinite waiting
    // On mobile devices (especially iPad Safari), session initialization can take longer
    // Wait a bit before redirecting to allow session to initialize from cookies
    // This helps with slower cookie/session initialization on mobile browsers
    timeoutRef.current = setTimeout(() => {
      // Re-check current auth state using refs (they're always up-to-date)
      if (userRef.current || sessionRef.current || loadingRef.current || profileStatusRef.current === 'loading' || redirected.current) {
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
    }, optimisticUser ? 2000 : 1000) // Wait longer if we have optimistic user

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [loading, profileStatus, optimisticLoading, optimisticUser, options?.redirectTo, pathname, router, user, session])

  // CRITICAL FIX: Return optimistic state if real state is still loading
  // This allows pages to render immediately on refresh if cache shows user exists
  // Also wait for profileStatus to be ready (not 'loading')
  const effectiveUser = user || optimisticUser
  // Show loading if:
  // - (loading OR profileStatus loading) AND optimisticLoading is true AND no optimistic user
  // OR
  // - profileStatus is loading AND we don't have a user yet (wait for both)
  const effectiveLoading = 
    ((loading || profileStatus === 'loading') && optimisticLoading && !optimisticUser) ||
    (profileStatus === 'loading' && !user && !optimisticUser)

  return { 
    user: effectiveUser, 
    loading: effectiveLoading, 
    isAuthenticated: !!effectiveUser 
  }
}
