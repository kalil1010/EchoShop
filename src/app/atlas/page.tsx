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

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(`/auth?redirect=/atlas`)
      return
    }
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
