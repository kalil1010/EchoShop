'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { deleteAvatarFromGallery, fetchAvatarGallery } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type { AvatarRenderRecord } from '@/types/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

export function AvatarGallerySection() {
  const { user, session } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<AvatarRenderRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxCaption, setLightboxCaption] = useState<string | undefined>(undefined)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const isAuthenticated = useMemo(() => Boolean(user && session), [user, session])

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

  const handleDelete = useCallback(
    async (storagePath: string) => {
      if (!storagePath) return
      if (!window.confirm('Are you sure you want to delete this avatar?')) return

      setDeletingId(storagePath)
      try {
        await deleteAvatarFromGallery(storagePath, { accessToken: session?.access_token })
        setItems((current) => current.filter((item) => item.storagePath !== storagePath))
        toast({ variant: 'success', title: 'Avatar removed' })
      } catch (err) {
        console.error('[profile-avatar-gallery] delete failed', err)
        const message = err instanceof Error ? err.message : 'Failed to delete avatar.'
        toast({
          variant: 'error',
          title: 'Could not delete avatar',
          description: message.includes('401') ? 'Sign in to manage your gallery.' : message,
        })
      } finally {
        setDeletingId((current) => (current === storagePath ? null : current))
      }
    },
    [session?.access_token, toast],
  )

  return (
    <>
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
            <p className="text-sm text-slate-500">Save an outfit avatar from the suggestions page to see it here.</p>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => {
                const created = new Date(item.createdAt)
                const isDeleting = deletingId === item.storagePath
                const formattedDate = created.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
                return (
                  <div
                    key={item.storagePath}
                    className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between px-3 pt-2">
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">{formattedDate}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs"
                        disabled={isDeleting}
                        onClick={() => void handleDelete(item.storagePath)}
                        aria-label="Delete avatar"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        <span>Delete</span>
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.publicUrl) {
                          toast({
                            variant: 'warning',
                            title: 'Image unavailable',
                            description: 'This avatar is not publicly accessible yet.',
                          })
                          return
                        }
                        setLightboxImage(item.publicUrl)
                        setLightboxCaption(`Saved avatar \u2014 ${created.toLocaleString()}`)
                      }}
                      disabled={isDeleting}
                      className={`mt-2 overflow-hidden rounded-b-xl border-t border-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        isDeleting ? 'cursor-not-allowed opacity-60' : ''
                      }`}
                    >
                      {item.publicUrl ? (
                        <img
                          src={item.publicUrl}
                          alt="Saved avatar"
                          loading="lazy"
                          className="h-32 w-full object-cover transition duration-150 hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
                          Preview not available
                        </div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageLightbox
        open={Boolean(lightboxImage)}
        imageUrl={lightboxImage}
        caption={lightboxCaption}
        onClose={() => {
          setLightboxImage(null)
          setLightboxCaption(undefined)
        }}
      />
    </>
  )
}
