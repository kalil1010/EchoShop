'use client'

import Link from 'next/link'

import { ImageGenerator } from '@/components/image/ImageGenerator'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function ImageGeneratorPage() {
  const { user, isAuthenticated, loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-1/3 rounded bg-slate-200" />
          <div className="h-5 w-2/3 rounded bg-slate-200" />
          <div className="h-[28rem] rounded-2xl bg-slate-200" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-md border-slate-200 shadow-sm">
          <CardContent className="space-y-3 p-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Sign in required</h2>
            <p className="text-slate-600">Create a free account to generate fashion images with ZMODA AI.</p>
            <Link href="/auth">
              <Button>Go to sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Fashion Image Lab</h1>
        <p className="text-slate-600">
          Generate editorial-grade visuals using the dedicated Mistral image agent—no keys ever leave the server.
        </p>
      </div>
      <div className="mx-auto max-w-5xl">
        <ImageGenerator />
      </div>
    </div>
  )
}
