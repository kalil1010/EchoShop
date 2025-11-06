'use client'

import React, { useEffect, useState, useRef } from 'react'
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
  const redirectHandledRef = useRef(false)
  const effectRunningRef = useRef(false)

  useEffect(() => {
    // Prevent concurrent effect runs during rapid auth state changes
    if (effectRunningRef.current) {
      return
    }

    // Prevent multiple redirects
    if (redirectHandledRef.current) {
      return
    }

    // Wait for auth context to finish loading
    if (authLoading) {
      return
    }

    // Mark effect as running to prevent concurrent executions
    effectRunningRef.current = true

    // Use a small delay to batch rapid auth state changes
    const timeoutId = setTimeout(() => {
      try {
        // Log auth state transitions for debugging
        console.debug('[owner-dashboard] Auth state check', {
          authLoading,
          hasUser: !!user,
          hasUserProfile: !!userProfile,
          userRole: user?.role,
          profileRole: userProfile?.role,
        })

        // If no user, redirect to login
        if (!user) {
          console.debug('[owner-dashboard] No user found, redirecting to login')
          redirectHandledRef.current = true
          setIsRedirecting(true)
          router.replace('/downtown')
          return
        }

        // Check if user has access
        const role = normaliseRole(userProfile?.role ?? user.role)
        const access = getPortalAccess(role, 'owner')

        console.debug('[owner-dashboard] Access check', {
          userId: user?.uid ?? null,
          role,
          allowed: access.allowed,
        })

        if (!access.allowed) {
          // This is expected behavior - log at debug level, not warn
          console.debug('[owner-dashboard] access denied', {
            userId: user?.uid ?? null,
            role,
            denial: access.denial ?? null,
          })
          
          redirectHandledRef.current = true
          setIsRedirecting(true)
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

        // User has access, show dashboard
        console.debug('[owner-dashboard] Access granted, showing dashboard')
        setIsLoading(false)
      } finally {
        // Reset the running flag after a delay to allow for state updates
        setTimeout(() => {
          effectRunningRef.current = false
        }, 100)
      }
    }, 50) // Small delay to batch rapid auth state changes

    return () => {
      clearTimeout(timeoutId)
      effectRunningRef.current = false
    }
  }, [user, userProfile, authLoading, router, toast])

  // Show loading state or prevent rendering during redirect
  // This must come AFTER all hooks are called
  if (isLoading || authLoading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Only render dashboard if user has access and we're not redirecting
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[owner-dashboard] Error caught by boundary:', error, errorInfo)
      }}
    >
      <OwnerDashboardLayout>
        {/* Existing dashboard content rendered inside the layout */}
      </OwnerDashboardLayout>
    </ErrorBoundary>
  )
}
