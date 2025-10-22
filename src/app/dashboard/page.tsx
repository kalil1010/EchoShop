'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/contexts/AuthContext'

export default function DashboardPage() {
  const { userProfile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!userProfile) {
      router.replace('/vendor/hub')
      return
    }

    const role = userProfile.role.toLowerCase()
    if (role === 'admin') {
      router.replace('/dashboard/system-owner')
    } else if (role === 'vendor') {
      router.replace('/dashboard/vendor')
    } else {
      router.replace('/vendor/hub')
    }
  }, [loading, userProfile, router])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
      </div>
    )
  }

  return null
}
