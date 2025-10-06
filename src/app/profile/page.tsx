'use client'

import Link from 'next/link'

import { MyPalettes } from '@/components/profile/MyPalettes'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ProfilePage() {
  const { user, loading, isAuthenticated } = useRequireAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="p-6 text-center space-y-3">
            <h2 className="text-xl font-semibold">Sign In Required</h2>
            <p className="text-gray-600">
              Please sign in to view and edit your profile.
            </p>
            <Link href="/auth">
              <Button>Go to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <ProfileForm />
      <MyPalettes />
    </div>
  )
}
