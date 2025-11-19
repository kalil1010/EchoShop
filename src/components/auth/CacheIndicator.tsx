'use client'

import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export function CacheIndicator() {
  const { usingCache } = useAuth()

  if (!usingCache) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-muted-foreground shadow-md border border-gray-200">
      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
      <span>Syncing session...</span>
    </div>
  )
}

