'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'
import AdminDashboardLayout from '@/components/admin/AdminDashboardLayout'

export default function DowntownPage() {
  const { userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const role = userProfile?.role?.toLowerCase()
    if (role !== 'admin') {
      if (role === 'vendor') {
        router.replace('/atlas')
      } else {
        router.replace('/vendor/hub')
      }
    }
  }, [loading, userProfile, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  if (userProfile?.role?.toLowerCase() !== 'admin') {
    return null
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <AdminDashboardLayout />
    </main>
  )
}
