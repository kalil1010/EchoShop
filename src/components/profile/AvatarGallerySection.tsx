'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { fetchAvatarGallery } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { AvatarRenderRecord } from '@/types/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function AvatarGallerySection() {
  const { user, session } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AvatarRenderRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuthenticated = useMemo(() => Boolean(user && session), [user, session])

  const openImageInNewTab = useCallback(
    (url?: string | null, fallbackMessage?: string) => {
      if (!url) {
        if (fallbackMessage) {
          toast({
            variant: 'warning',
            title: 'Image unavailable',
            description: fallbackMessage,
          })
        }
        return
      }

      const popup = window.open(url, '_blank', 'noopener,noreferrer')
      if (!popup) {
        toast({
          variant: 'warning',
          title: 'Pop-up blocked',
          description: 'Allow pop-ups or open the link manually to view the image.',
        })
      }
    },
    [toast]
  )

  const loadGallery = useCallback(async () => {
    if (!isAuthenticated || !user?.uid) {
      setItems([])
      setError('Sign in to view your avatar gallery.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await fetchAvatarGallery({ accessToken: session?.access_token })
      setItems(result)
    } catch (err) {
      console.error('[profile-avatar-gallery] failed to load', err)
      const message = err instanceof Error ? err.message : 'Could not load avatar gallery.'
      setError(message.includes('401') ? 'Sign in to view your avatar gallery.' : message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, session?.access_token, user?.uid])

  useEffect(() => {
    void loadGallery()
  }, [loadGallery])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Avatar Gallery</CardTitle>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void loadGallery()}
          disabled={loading || !isAuthenticated}
          className="gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {error}
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            <span>Loading your saved avatars...</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-500">
            Save an outfit avatar from the suggestions page to see it here.
          </p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const created = new Date(item.createdAt)
              return (
                <button
                  key={item.storagePath}
                  type="button"
                  onClick={() => openImageInNewTab(item.publicUrl, 'This avatar is not publicly accessible yet.')}
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {item.publicUrl ? (
                    <img
                      src={item.publicUrl}
                      alt="Saved avatar"
                      className="h-32 w-full object-cover transition duration-150 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                      Preview not available
                    </div>
                  )}
                  <div className="border-t border-slate-100 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
                    {created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
