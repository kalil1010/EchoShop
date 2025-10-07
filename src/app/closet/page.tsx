'use client'

import Link from 'next/link'

import { ClosetView } from '@/components/closet/ClosetView'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReactionBar } from '@/components/ui/ReactionBar'

export default function ClosetPage() {
  const { user, loading, isAuthenticated } = useRequireAuth()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded col-span-2" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
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
              Please sign in to view and manage your closet.
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
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr),320px]">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Digital Closet</h1>
            <p className="text-gray-600">Organize your clothing collection and get insights into your wardrobe.</p>
          </div>
          <ClosetView />
        </div>
        <aside className="flex h-fit flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Quick steps</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Make the most of your closet</h2>
          </div>
          <ol className="space-y-3 text-sm text-slate-600">
            <li><span className="font-semibold text-purple-600">1.</span> Upload a garment photo with good lighting - ZMODA auto-detects colors.</li>
            <li><span className="font-semibold text-purple-600">2.</span> Add notes or tags so you can search by occasion later on.</li>
            <li><span className="font-semibold text-purple-600">3.</span> Save the generated palette to reuse when styling outfits.</li>
          </ol>
          <div className="rounded-2xl bg-white p-4 text-xs text-slate-500">Pro tip: drag and drop multiple photos to batch upload, or revisit an item to refresh its palette anytime.</div>
          <ReactionBar featureSlug="closet_page" />
        </aside>
      </div>
    </div>
  )
}

