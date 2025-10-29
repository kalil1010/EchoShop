'use client'

import { useEffect, useRef, useState } from 'react'

import VendorDashboardLayout from '@/components/vendor/VendorDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { VendorLoginForm } from '@/components/vendor/VendorLoginForm'
import { getPortalAccess } from '@/lib/roles'
import type { PortalDenial } from '@/lib/roles'
import { useToast } from '@/components/ui/toast'

export default function AtlasPage() {
  const { user, profile, loading, logout } = useAuth()
  const { toast } = useToast()
  const [denial, setDenial] = useState<PortalDenial | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return

    const access = getPortalAccess(profile.role, 'vendor')
    if (!access.allowed) {
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

        if (access.denial?.requiresLogout) {
          logout().catch(() => undefined)
        }
      }
      return
    }

    setDenial(null)
    handledRef.current = false
  }, [loading, profile, logout, toast])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <VendorLoginForm initialNotice={denial} />
        </div>
      </div>
    )
  }

  if (profile?.role === 'vendor') {
    return (
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <VendorDashboardLayout />
      </main>
    )
  }

  return null
}
