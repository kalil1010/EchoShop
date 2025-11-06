'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { getDefaultRouteForRole, getPortalAccess, normaliseRole } from '@/lib/roles'

export default function OwnerDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, userProfile, loading: authLoading } = useAuth()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) {
      return
    }

    // If no user, redirect to login
    if (!user) {
      router.replace('/downtown')
      return
    }

    // Check if user has access
    const role = normaliseRole(userProfile?.role ?? user.role)
    const access = getPortalAccess(role, 'owner')

    if (!access.allowed) {
      console.warn('[owner-dashboard] access denied', {
        userId: user?.uid ?? null,
        role,
        denial: access.denial ?? null,
      })
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
    setIsLoading(false)
  }, [user, userProfile, authLoading, router, toast])

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <OwnerDashboardLayout>
      {/* Existing dashboard content rendered inside the layout */}
    </OwnerDashboardLayout>
  )
}
