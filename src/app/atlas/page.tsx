'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import VendorDashboardLayout from '@/components/vendor/VendorDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function AtlasPage() {
  const { userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const role = userProfile?.role?.toLowerCase()
    const hasApproval = Boolean(userProfile?.vendorApprovedAt)

    if (role === 'admin') {
      router.replace('/downtown')
      return
    }

    if (role !== 'vendor' || !hasApproval) {
      router.replace('/vendor/hub')
    }
  }, [loading, userProfile, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  const role = userProfile?.role?.toLowerCase()
  const hasApproval = Boolean(userProfile?.vendorApprovedAt)
  if (role !== 'vendor' || !hasApproval) {
    return null
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <VendorDashboardLayout />
    </main>
  )
}
