'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDefaultRouteForRole } from '@/lib/roles'

export default function AuthCallbackPage() {
  const { userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!userProfile) {
      // No profile yet, redirect to auth page
      router.replace('/auth')
      return
    }

    // Vendor users always go to vendor dashboard
    if (userProfile.role === 'vendor') {
      router.replace('/atlas')
      return
    }

    // Other users go to their default route
    const destination = getDefaultRouteForRole(userProfile.role)
    router.replace(destination)
  }, [loading, userProfile, router])

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center space-y-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600 mx-auto" />
        <p className="text-sm text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}

