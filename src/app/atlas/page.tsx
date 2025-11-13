'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import VendorDashboardLayout from '@/components/vendor/VendorDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { getPortalAccess } from '@/lib/roles'
import type { PortalDenial } from '@/lib/roles'
import { useToast } from '@/components/ui/toast'

export default function AtlasPage() {
  const { user, profile, loading, logout } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [denial, setDenial] = useState<PortalDenial | null>(null)
  const handledRef = useRef(false)
  const sessionCheckAttemptsRef = useRef(0)
  const MAX_SESSION_CHECK_ATTEMPTS = 5 // Wait up to 2.5 seconds for session restoration

  useEffect(() => {
    // Wait for loading to complete AND give extra time for session restoration from localStorage
    if (loading) {
      sessionCheckAttemptsRef.current = 0
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
      router.replace(`/auth?redirect=/atlas`)
      return
    }

    // Reset attempts once we have a user
    sessionCheckAttemptsRef.current = 0

    if (!profile) {
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

        // Redirect to /auth with role info
        router.replace(`/auth?redirect=/atlas&role=${profile.role}`)
      }
      return
    }

    setDenial(null)
    handledRef.current = false
  }, [loading, profile, user, router, logout, toast])

  if (loading) {
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
