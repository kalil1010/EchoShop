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

  useEffect(() => {
    // Clear any existing timeout to prevent multiple simultaneous checks
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Wait for auth context to finish initializing
    if (authLoading) {
      setIsLoading(true)
      return
    }

    // If no user after auth has loaded, redirect to login immediately
    if (!user) {
      console.debug('[owner-dashboard] No user found after auth load, redirecting to login')
      setIsRedirecting(true)
      setIsLoading(false)
      setHasAccess(false)
      lastCheckedUserIdRef.current = null
      router.replace('/downtown')
      return
    }

    // Check if this is a different user than we last checked
    // If so, reset access state to re-check
    if (lastCheckedUserIdRef.current !== user.uid) {
      setHasAccess(false)
      setIsLoading(true)
      lastCheckedUserIdRef.current = user.uid
    }

    // Use a small delay to batch rapid auth state changes and prevent React error #300
    // This allows the profile to finish loading if it's still in progress
    timeoutRef.current = setTimeout(() => {
      try {
        // Log auth state transitions for debugging
        console.debug('[owner-dashboard] Auth state check', {
          authLoading,
          hasUser: !!user,
          hasUserProfile: !!userProfile,
          userRole: user?.role,
          profileRole: userProfile?.role,
        })

        // Determine the user's role - prefer profile role, fall back to user role
        // If we don't have a profile yet, use the user's role from auth metadata
        const role = normaliseRole(userProfile?.role ?? user.role)
        
        // Check if user has access to owner portal
        const access = getPortalAccess(role, 'owner')

        console.debug('[owner-dashboard] Access check', {
          userId: user?.uid ?? null,
          role,
          allowed: access.allowed,
          hasProfile: !!userProfile,
        })

        if (!access.allowed) {
          // User doesn't have owner access - redirect them
          console.debug('[owner-dashboard] Access denied', {
            userId: user?.uid ?? null,
            role,
            denial: access.denial ?? null,
          })
          
          setIsRedirecting(true)
          setIsLoading(false)
          setHasAccess(false)
          
          const toastPayload = access.denial?.toast
          toast({
            variant: toastPayload?.variant ?? 'warning',
            title: toastPayload?.title ?? 'Access denied',
            description:
              toastPayload?.description ??
              'You do not have permission to access the owner console.',
          })

          router.replace(access.denial?.redirect ?? getDefaultRouteForRole(role))
          return
        }

        // User has owner access - show dashboard
        console.debug('[owner-dashboard] Access granted, showing dashboard')
        setIsLoading(false)
        setIsRedirecting(false)
        setHasAccess(true)
      } catch (error) {
        console.error('[owner-dashboard] Error in auth check:', error)
        setIsLoading(false)
        setHasAccess(false)
      }
    }, 150) // Small delay to allow profile to load and prevent rapid re-renders

    // Cleanup function - always returned to prevent React error #300
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, userProfile, authLoading, router, toast])

  // Memoize the loading state to prevent unnecessary re-renders
  const isLoadingState = useMemo(() => {
    return isLoading || authLoading || isRedirecting
  }, [isLoading, authLoading, isRedirecting])

  // Compute whether to show dashboard based on loading, access state, and redirect status
  // Only show dashboard when we have access, are not loading, not redirecting, and have a user
  const showDashboard = hasAccess && !isLoadingState && !isRedirecting && user && !authLoading

  // Always render the same ErrorBoundary structure to prevent React error #300
  // This ensures the component tree structure remains consistent across re-renders
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[owner-dashboard] Error caught by boundary:', error, errorInfo)
      }}
    >
      {showDashboard ? (
        <OwnerDashboardLayout
          isLoading={isLoadingState}
          user={user}
          userProfile={userProfile}
        />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
            <p className="text-gray-600">
              {isRedirecting ? 'Redirecting...' : 'Loading dashboard...'}
            </p>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}
