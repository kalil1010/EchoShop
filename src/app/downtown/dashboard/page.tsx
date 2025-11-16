'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { getDefaultRouteForRole, getPortalAccess, normaliseRole } from '@/lib/roles'

export default function OwnerDashboardPage() {
  // ALL hooks must be called unconditionally before any returns (Rules of Hooks)
  const router = useRouter()
  const { toast } = useToast()
  const { user, userProfile, loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckedUserIdRef = useRef<string | null>(null)
  const sessionCheckAttemptsRef = useRef(0)
  const hasAccessRef = useRef(false) // Use ref to track access without causing re-renders
  const MAX_SESSION_CHECK_ATTEMPTS = 5 // Wait up to 2.5 seconds for session restoration

  useEffect(() => {
    // Clear any existing timeout to prevent multiple simultaneous checks
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Wait for auth context to finish initializing
    if (authLoading) {
      sessionCheckAttemptsRef.current = 0
      setIsLoading(true)
      return
    }

    // If no user after auth has loaded, wait a bit for session restoration from localStorage
    // This handles the race condition where middleware allows the request but
    // AuthContext hasn't finished restoring session from localStorage yet
    if (!user) {
      if (sessionCheckAttemptsRef.current < MAX_SESSION_CHECK_ATTEMPTS) {
        sessionCheckAttemptsRef.current += 1
        // Wait 500ms before checking again (allows localStorage session to be restored)
        timeoutRef.current = setTimeout(() => {
          // The useEffect will run again due to dependency changes
        }, 500)
        return () => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
        }
      }
      // After max attempts, check localStorage directly as a last resort
      // Only redirect if we're certain there's no session
      if (typeof window !== 'undefined') {
        const hasAuthStorage = Object.keys(localStorage).some(key => 
          key.includes('supabase.auth') || key.includes('sb-')
        )
        if (hasAuthStorage) {
          // Auth storage exists, wait a bit more for restoration
          console.debug('[owner-dashboard] Auth storage found, waiting for session restoration...')
          return
        }
      }
      // No auth storage found, redirect to login
      console.debug('[owner-dashboard] No user and no auth storage, redirecting to login')
      setIsRedirecting(true)
      setIsLoading(false)
      setHasAccess(false)
      hasAccessRef.current = false
      lastCheckedUserIdRef.current = null
      
      // Use a timeout to prevent rapid redirects and ensure auth state is cleared
      // Redirect to /downtown (login page) instead of home to allow re-login
      timeoutRef.current = setTimeout(() => {
        router.replace('/downtown')
      }, 100)
      return
    }

    // Reset attempts once we have a user
    sessionCheckAttemptsRef.current = 0

    // CRITICAL FIX: Check if we already verified access for this exact user/profile combination
    // This prevents infinite loops when userProfile changes but user hasn't
    const currentUserId = user.uid
    const currentProfileRole = userProfile?.role
    const checkKey = `${currentUserId}:${currentProfileRole || 'unknown'}`
    
    // If we already have access and same user/profile, skip re-check
    if (hasAccessRef.current && lastCheckedUserIdRef.current === checkKey && userProfile && !isLoading) {
      console.debug('[owner-dashboard] Already verified access, skipping re-check', { checkKey })
      return
    }

    // Check if this is a different user than we last checked
    // If so, reset access state to re-check
    if (lastCheckedUserIdRef.current && !lastCheckedUserIdRef.current.startsWith(currentUserId)) {
      setHasAccess(false)
      hasAccessRef.current = false
      setIsLoading(true)
    }
    
    // Update last checked reference with userId:role to track both
    lastCheckedUserIdRef.current = checkKey

    // CRITICAL: Don't check access if profile is still loading (unless we have a fallback role)
    // Wait for profile to load OR use user.role if available
    const role = normaliseRole(userProfile?.role ?? user?.role)
    
    // If we don't have a role yet and profile is still loading, wait
    // BUT: If we have user.role from auth metadata, use it (owner role is set in auth metadata)
    if (!role || (role === 'user' && !userProfile && !user?.role && authLoading)) {
      console.debug('[owner-dashboard] Waiting for profile to load...', { 
        hasUserRole: !!user?.role,
        hasProfile: !!userProfile,
        currentRole: role 
      })
      return
    }

    // Use a minimal delay only if profile is still loading
    const delay = userProfile ? 0 : 100 // Small delay if profile not ready
    timeoutRef.current = setTimeout(() => {
      try {
        // Determine the user's role - prefer profile role, fall back to user role
        const finalRole = normaliseRole(userProfile?.role ?? user?.role ?? role)
        
        console.debug('[owner-dashboard] Checking access', { 
          userId: currentUserId, 
          role: finalRole,
          hasProfile: !!userProfile 
        })
        
        // Check if user has access to owner portal
        const access = getPortalAccess(finalRole, 'owner')

        if (!access.allowed) {
          // User doesn't have owner access - redirect them
          console.debug('[owner-dashboard] Access denied', { role: finalRole })
          setIsRedirecting(true)
          setIsLoading(false)
          setHasAccess(false)
          hasAccessRef.current = false
          
          const toastPayload = access.denial?.toast
          toast({
            variant: toastPayload?.variant ?? 'warning',
            title: toastPayload?.title ?? 'Access denied',
            description:
              toastPayload?.description ??
              'You do not have permission to access the owner console.',
          })

          router.replace(access.denial?.redirect ?? getDefaultRouteForRole(finalRole))
          return
        }

        // User has owner access - show dashboard immediately
        console.debug('[owner-dashboard] Access granted, showing dashboard')
        setIsLoading(false)
        setIsRedirecting(false)
        setHasAccess(true)
        hasAccessRef.current = true // Update ref to prevent re-checks
      } catch (error) {
        console.error('[owner-dashboard] Error in auth check:', error)
        setIsLoading(false)
        setHasAccess(false)
        hasAccessRef.current = false
      }
    }, delay)

    // Cleanup function - always returned to prevent React error #300
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, userProfile, authLoading, router, toast])

  // Memoize the loading state to prevent unnecessary re-renders
  // Include !hasAccess in loading state so dashboard doesn't show until access is confirmed
  const isLoadingState = useMemo(() => {
    return isLoading || authLoading || isRedirecting || !hasAccess
  }, [isLoading, authLoading, isRedirecting, hasAccess])

  // CRITICAL: Always render the exact same component structure to prevent React error #300
  // React error #300 occurs when the component tree structure changes between renders,
  // causing hooks to be called in different orders. By always rendering OwnerDashboardLayout
  // (even when redirecting), we ensure hooks are always called in the same order.
  // The layout component will handle showing loading/redirect states internally.
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[owner-dashboard] Error caught by boundary:', error, errorInfo)
      }}
    >
      <OwnerDashboardLayout
        isLoading={isLoadingState}
        isRedirecting={isRedirecting}
        user={user}
        userProfile={userProfile}
      />
    </ErrorBoundary>
  )
}
