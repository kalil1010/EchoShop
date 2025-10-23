'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import VendorDashboardLayout from '@/components/vendor/VendorDashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import { VendorLoginForm } from '@/components/vendor/VendorLoginForm'

export default function AtlasPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (user && profile && profile.role !== 'vendor') {
      if (profile.role === 'admin') {
        router.replace('/downtown')
      } else {
        router.replace('/vendor/hub')
      }
    }
  }, [loading, user, profile, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <VendorLoginForm />
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
