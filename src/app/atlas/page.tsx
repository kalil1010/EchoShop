'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import VendorDashboardLayout from '@/components/vendor/VendorDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { getPortalAccess, getDefaultRouteForRole } from '@/lib/roles'
import type { PortalDenial } from '@/lib/roles'
import { useToast } from '@/components/ui/toast'

export default function AtlasPage() {
  const { user, profile, loading, logout, profileStatus } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [denial, setDenial] = useState<PortalDenial | null>(null)
  const handledRef = useRef(false)
  const sessionCheckAttemptsRef = useRef(0)
  const MAX_SESSION_CHECK_ATTEMPTS = 5 // Wait up to 2.5 seconds for session restoration

  // Track if we've already verified access to prevent re-checks
  const verifiedRef = useRef(false)
  const verifiedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Task B2: Wait for loading to complete AND profile status to be ready
    if (loading || profileStatus === 'loading') {
      sessionCheckAttemptsRef.current = 0
      return
    }

    // If we've already verified access for this user, skip re-check
    // This prevents reloads when tab regains focus
    if (verifiedRef.current && verifiedUserIdRef.current === user?.uid && profile) {
      return
    }

    // If no user after loading, wait a bit for session restoration from localStorage
    // This handles the race condition where middleware allows the request but
    // AuthContext hasn't finished restoring session from localStorage yet
    if (!user) {
      if (sessionCheckAttemptsRef.current < MAX_SESSION_CHECK_ATTEMPTS) {
        sessionCheckAttemptsRef.current += 1
        // Wait 500ms before checking again (allows localStorage session to be restored)
        const timeoutId = setTimeout(() => {
          // The useEffect will run again due to dependency changes
        }, 500)
        return () => clearTimeout(timeoutId)
      }
      // After max attempts, check localStorage directly as a last resort
      // Only redirect if we're certain there's no session
      if (typeof window !== 'undefined') {
        const hasAuthStorage = Object.keys(localStorage).some(key => 
          key.includes('supabase.auth') || key.includes('sb-')
        )
        if (hasAuthStorage) {
          // Auth storage exists, wait a bit more for restoration
          console.debug('[atlas] Auth storage found, waiting for session restoration...')
          return
        }
      }
      // No auth storage found, redirect to login
      console.debug('[atlas] No user and no auth storage, redirecting to login')
      verifiedRef.current = false
      verifiedUserIdRef.current = null
      router.replace(`/auth?redirect=/atlas`)
      return
    }

    // Reset attempts once we have a user
    sessionCheckAttemptsRef.current = 0

    if (!profile) {
      verifiedRef.current = false
      verifiedUserIdRef.current = null
      router.replace('/auth?redirect=/atlas&missingProfile=true')
      return
    }

    const access = getPortalAccess(profile.role, 'vendor')
    if (!access.allowed) {
      console.warn('[atlas] access denied', {
        userId: user?.uid ?? null,
        role: profile.role,
        denial: access.denial ?? null,
      })
      setDenial(access.denial ?? null)
      verifiedRef.current = false
      verifiedUserIdRef.current = null

      if (!handledRef.current) {
        handledRef.current = true
        const toastPayload = access.denial?.toast
        toast({
          variant: toastPayload?.variant ?? 'warning',
          title: toastPayload?.title ?? 'Access denied',
          description:
            toastPayload?.description ??
            'You do not have permission to open the vendor dashboard.',
        })

        // Task B2: Redirect to their correct dashboard based on role
        const defaultRoute = getDefaultRouteForRole(profile.role)
        router.replace(access.denial?.redirect ?? defaultRoute)
      }
      return
    }

    // Access granted - mark as verified
    verifiedRef.current = true
    verifiedUserIdRef.current = user.uid
    setDenial(null)
    handledRef.current = false
  }, [loading, profile, user, router, logout, toast, profileStatus])

  // Task B2: Show loading state while auth context is hydrating
  if (loading || profileStatus === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  if (!user || !profile) {
    return null // useEffect handles redirect
  }

  if (profile.role === 'vendor') {
    return (
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <VendorDashboardLayout />
      </main>
    )
  }

  return null // useEffect handles redirect for wrong role
}
