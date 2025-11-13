'use client'

import Link from 'next/link'

import { StylistChat } from '@/components/chat/StylistChat'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RoleGuard } from '@/components/auth/RoleGuard'

export default function ChatPage() {
  const { user, loading, isAuthenticated } = useRequireAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8" />
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
              Please sign in to chat with Echo Shop.
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
    <RoleGuard allowedRoles={['user']}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Echo Shop Chat</h1>
          <p className="text-gray-600">
            Chat with Echo Shop for fashion advice and styling tips
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <StylistChat />
        </div>
      </div>
    </RoleGuard>
  )
}
