'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MultiSelectChips } from '@/components/ui/multi-select-chips'
import { WeatherCard } from '@/components/weather/WeatherCard'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { getUserClothing, toClosetSummary, type ClosetItemSummary } from '@/lib/closet'
import { isPermissionError } from '@/lib/security'
import {
  fetchAvatarGallery,
  generateImage,
  getOutfitSuggestion,
  OutfitPieceRecommendation,
  OutfitSuggestionResponse,
  saveAvatarToGallery,
} from '@/lib/api'
import { WeatherData } from '@/lib/weather'
import { AlertTriangle, BookmarkPlus, Download, Image as ImageIcon, Loader2, Shirt, Sparkles, Zap } from 'lucide-react'
import type { AvatarRenderRecord } from '@/types/avatar'
const COLOR_SWATCH_MAP: Record<string, string> = {
  black: '#111827',
  charcoal: '#374151',
  graphite: '#4b5563',
  navy: '#1f2937',
  ivory: '#f8f1e7',
  gold: '#d4af37',
  silver: '#9ca3af',
  neutral: '#9ca3af',
  beige: '#d6c3a5',
  tan: '#d2b48c',
  brown: '#6b4f2a',
  white: '#f5f5f5',
}

const resolveSwatchColor = (value?: string) => {
  if (!value) return COLOR_SWATCH_MAP.neutral
  const trimmed = value.trim()
  const key = trimmed.toLowerCase()
  if (COLOR_SWATCH_MAP[key]) return COLOR_SWATCH_MAP[key]
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed
  if (/^(rgb|hsl)a?\(/i.test(trimmed)) return trimmed
  return COLOR_SWATCH_MAP.neutral
}

const formatColorLabel = (value?: string) => {
  if (!value) return 'Neutral'
  const trimmed = value.trim()
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}



export function OutfitSuggestion() {
  const { user, userProfile, session } = useAuth()
  const { toast } = useToast()
  const [occasion, setOccasion] = useState('')
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [suggestion, setSuggestion] = useState<OutfitSuggestionResponse | null>(null)
  const [closetItems, setClosetItems] = useState<ClosetItemSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<{
    displayUrl: string
    objectUrl: string
    persistentUrl?: string
    storagePath?: string
    fileId: string | null
    generatedAt: Date
  } | null>(null)
  const avatarObjectUrlRef = useRef<string | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [gallery, setGallery] = useState<AvatarRenderRecord[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const isAuthenticated = Boolean(user && session)

  useEffect(() => {
    console.debug('[avatar] auth state snapshot', {
      userId: user?.uid,
      email: user?.email,
      profileReady: Boolean(userProfile),
      profileGender: userProfile?.gender,
      sessionPresent: Boolean(session),
    })
  }, [user?.uid, user?.email, userProfile, session?.access_token])

  const clearAvatarObjectUrl = useCallback(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current)
      avatarObjectUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearAvatarObjectUrl()
    }
  }, [clearAvatarObjectUrl])

  useEffect(() => {
    let active = true

    const loadCloset = async () => {
      if (!isAuthenticated || !user?.uid) {
        if (active) {
          setClosetItems([])
        }
        return
      }
      try {
        const items = await getUserClothing(user.uid)
        if (active) {
          setClosetItems(toClosetSummary(items, 20))
        }
      } catch (error) {
        console.warn('Failed to load closet summary for suggestions:', error)
        if (active) {
          if (isPermissionError(error)) {
            toast({
              variant: 'error',
              title: error.reason === 'auth' ? 'Session expired' : 'Access denied',
              description:
                error.reason === 'auth'
                  ? 'Please sign in again to use your closet items.'
                  : 'We could not access your closet for outfit suggestions.',
            })
          } else {
            toast({ variant: 'error', title: 'Failed to load closet items', description: 'We will continue without closet context.' })
          }
          setClosetItems([])
        }
      }
    }

    loadCloset()
    return () => {
      active = false
    }
  }, [isAuthenticated, user?.uid, session?.access_token])

  const loadGallery = useCallback(async () => {
    if (!isAuthenticated || !user?.uid) {
      console.debug('[avatar-gallery] skipped load - unauthenticated')
      setGallery([])
      return
    }
    setGalleryLoading(true)
    setGalleryError(null)
    console.debug('[avatar-gallery] fetching items', { userId: user.uid })
    try {
      const items = await fetchAvatarGallery({ accessToken: session?.access_token })
      console.debug('[avatar-gallery] fetched', { count: items.length })
      setGallery(items)
    } catch (error) {
      console.error('Failed to load avatar gallery:', error)
      const rawMessage = error instanceof Error ? error.message : 'Could not load saved avatars.'
      const friendly = rawMessage.includes('401') ? 'Sign in to view your avatar gallery.' : rawMessage
      setGalleryError(friendly)
    } finally {
      setGalleryLoading(false)
    }
  }, [isAuthenticated, user?.uid])

  useEffect(() => {
    void loadGallery()
  }, [loadGallery])

  const triggerAvatarGeneration = useCallback(
    async (outfit: OutfitSuggestionResponse, occasionLabel: string, weatherSnapshot: WeatherData | null) => {
      if (!occasionLabel) return

      if (!isAuthenticated) {
        console.debug('[avatar] generation skipped - unauthenticated')
        setAvatarError('Sign in to generate a personalized avatar.')
        setAvatarPreview(null)
        setAvatarLoading(false)
        return
      }

      setAvatarLoading(true)
      setAvatarError(null)
      clearAvatarObjectUrl()
      setAvatarPreview(null)

      try {
        const profileInput = userProfile
          ? {
              gender: userProfile.gender ?? undefined,
              heightCm: userProfile.height ?? undefined,
              weightKg: userProfile.weight ?? undefined,
              photoUrl: userProfile.photoURL ?? undefined,
              displayName: userProfile.displayName ?? undefined,
            }
          : undefined

        const contextPayload = weatherSnapshot
          ? {
              occasion: occasionLabel,
              location: weatherSnapshot.location,
              temperatureC: weatherSnapshot.temperature,
              condition: weatherSnapshot.condition,
            }
          : { occasion: occasionLabel }

        const response = await generateImage(
          {
            purpose: 'avatar',
            outfit,
            profile: profileInput,
            context: contextPayload,
            metadata: {
              source: 'outfit-suggestion',
              userId: user?.uid ?? null,
              location: weatherSnapshot?.location ?? null,
            },
          },
          { accessToken: session?.access_token }
        )

        const objectUrl = URL.createObjectURL(response.blob)
        avatarObjectUrlRef.current = objectUrl
        const displayUrl = response.avatarUrl ?? objectUrl

        console.debug('[avatar] generated', {
          fileId: response.fileId,
          avatarUrl: response.avatarUrl,
          storagePath: response.storagePath,
        })

        setAvatarPreview({
          displayUrl,
          objectUrl,
          persistentUrl: response.avatarUrl ?? undefined,
          storagePath: response.storagePath ?? undefined,
          fileId: response.fileId ?? null,
          generatedAt: new Date(),
        })
      } catch (error) {
        console.error('Avatar generation failed:', error)
        const message =
          error instanceof Error ? error.message : 'We could not personalize the avatar right now.'
        setAvatarError(message)
        toast({
          variant: 'warning',
          title: 'Avatar unavailable',
          description: message,
        })
      } finally {
        setAvatarLoading(false)
      }
    },
    [clearAvatarObjectUrl, toast, user?.uid, userProfile, isAuthenticated]
  )


  const handleGetSuggestion = async () => {
    const occasionText = selectedOccasions[0] || ''
    if (!occasionText || !weather) {
      toast({ variant: 'error', title: 'Missing details', description: 'Add an occasion and confirm weather data before requesting an outfit.' })
      return
    }

    setOccasion(occasionText)
    setLoading(true)
    try {
      const result = await getOutfitSuggestion({
        occasion: occasionText,
        weather,
        userProfile: userProfile || undefined,
        userId: user?.uid,
        closetItems: closetItems.length > 0 ? closetItems : undefined,
      })
      setSuggestion(result)
      void triggerAvatarGeneration(result, occasionText, weather)
    } catch (error) {
      console.error('Failed to get outfit suggestion:', error)
      toast({ variant: 'error', title: 'Suggestion failed', description: 'Please try again in a moment.' })
    } finally {
      setLoading(false)
    }
  }

  const paletteColors = useMemo(() => {
    if (!suggestion) return [] as string[]
    const set = new Set<string>()
    const add = (value?: string) => {
      if (!value) return
      const label = formatColorLabel(value)
      set.add(label)
    }
    add(suggestion.top?.color)
    add(suggestion.bottom?.color)
    add(suggestion.footwear?.color)
    if (suggestion.outerwear?.color) add(suggestion.outerwear.color)
    suggestion.accessories?.forEach((accessory) => add(accessory.color))
    return Array.from(set)
  }, [suggestion])

  const profileDataIncomplete = useMemo(() => {
    if (!userProfile) return true
    return !userProfile.height || !userProfile.weight || !userProfile.gender
  }, [userProfile])

  const canRefreshAvatar = Boolean(isAuthenticated && suggestion && weather && (occasion || selectedOccasions[0]))
  const canSaveToGallery = Boolean(isAuthenticated && avatarPreview?.storagePath && !avatarSaving)
  const fullImageUrl = avatarPreview?.persistentUrl ?? avatarPreview?.displayUrl ?? ''

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

  const handleAvatarRefresh = useCallback(() => {
    if (!suggestion || !weather) return
    const occ = occasion || selectedOccasions[0] || ''
    if (!occ) return
    void triggerAvatarGeneration(suggestion, occ, weather)
  }, [occasion, selectedOccasions, suggestion, triggerAvatarGeneration, weather])

  const handleDownloadAvatar = useCallback(() => {
    if (!avatarPreview) return
    const downloadUrl = fullImageUrl || avatarPreview.objectUrl
    const extension = downloadUrl.toLowerCase().includes('.webp')
      ? 'webp'
      : downloadUrl.toLowerCase().includes('.jpg') || downloadUrl.toLowerCase().includes('.jpeg')
      ? 'jpg'
      : 'png'
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = `zmoda-avatar-${Date.now()}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [avatarPreview, fullImageUrl])

  const handleSaveToGallery = useCallback(async () => {
    if (!isAuthenticated) {
      toast({
        variant: 'warning',
        title: 'Sign in required',
        description: 'Sign in to save avatars to your gallery.',
      })
      return
    }

    if (!avatarPreview) {
      toast({
        variant: 'warning',
        title: 'Avatar not ready',
        description: 'Generate an avatar before saving it to your gallery.',
      })
      return
    }
    if (!avatarPreview.storagePath) {
      toast({
        variant: 'warning',
        title: 'Storage pending',
        description: 'Please regenerate the avatar to capture a storable version.',
      })
      return
    }

    setAvatarSaving(true)
    console.debug('[avatar-gallery] saving request', {
      storagePath: avatarPreview.storagePath,
      persistentUrl: avatarPreview.persistentUrl,
    })
    try {
      const saved = await saveAvatarToGallery(
        {
          storagePath: avatarPreview.storagePath,
          publicUrl: avatarPreview.persistentUrl ?? undefined,
        },
        { accessToken: session?.access_token }
      )
      setGallery((prev) => {
        const withoutExisting = prev.filter((item) => item.storagePath !== saved.storagePath)
        return [saved, ...withoutExisting]
      })
      setGalleryError(null)
      toast({
        variant: 'success',
        title: 'Saved to gallery',
        description: 'Find this look anytime in your avatar gallery.',
      })
    } catch (error) {
      console.error('Save avatar failed:', error)
      const rawMessage = error instanceof Error ? error.message : 'Please try again shortly.'
      toast({
        variant: 'error',
        title: 'Could not save avatar',
        description: rawMessage.includes('401') ? 'Sign in to save avatars.' : rawMessage,
      })
    } finally {
      setAvatarSaving(false)
    }
  }, [avatarPreview, toast, isAuthenticated, session?.access_token])

  const renderOutfitItem = (label: string, item: OutfitPieceRecommendation | undefined) => {
    if (!item) return null
    const sourceLabel = item.source === 'online' ? 'Online pick' : item.source === 'closet' ? 'Closet pick' : undefined
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">{label}</h4>
        <p className="text-sm text-gray-800">{item.summary}</p>
        <div className="flex flex-wrap gap-2">
          {item.color && (
            <span className="inline-flex items-center gap-3 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
              <span
                className="h-6 w-6 rounded-full border border-black/10"
                style={{ backgroundColor: resolveSwatchColor(item.color) }}
              />
              Color: {formatColorLabel(item.color)}
            </span>
          )}
          {sourceLabel && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {sourceLabel}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WeatherCard onWeatherUpdate={setWeather} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shirt className="mr-2 h-5 w-5" />
              Outfit Request
            </CardTitle>
            <CardDescription>
              Select your occasion(s) and we'll suggest the perfect outfit
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Occasion</label>
              <MultiSelectChips
                options={[
                  'Business Meeting',
                  'Casual Dinner',
                  'Wedding',
                  'Date Night',
                  'Outdoor Activity',
                  'Travel',
                  'Party',
                  'Interview',
                  'Gym',
                  'Beach Day',
                ].map((o) => ({ label: o, value: o.toLowerCase() }))}
                value={selectedOccasions}
                onChange={setSelectedOccasions}
                single
              />
            </div>

            <Button
              onClick={handleGetSuggestion}
              className="w-full"
              disabled={loading || selectedOccasions.length !== 1 || !weather}
            >
              {loading ? (
                <>
                  <Zap className="mr-2 h-4 w-4 animate-pulse" />
                  Generating Suggestion...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Get Outfit Suggestion
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {suggestion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
              Your Personalized Outfit
            </CardTitle>
            <CardDescription>
              Perfect for {occasion || selectedOccasions[0]} in {weather?.location}
            </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ImageIcon className="h-4 w-4 text-purple-500" />
              Personalized avatar preview
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAvatarRefresh}
              disabled={!canRefreshAvatar || avatarLoading}
              className="self-start md:self-auto"
            >
              {avatarLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rendering...
                </>
              ) : (
                'Refresh avatar'
              )}
            </Button>
          </div>

          {!isAuthenticated && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Sign in to generate, download, or save personalized avatars.
            </div>
          )}

          {avatarLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span>Tailoring the outfit to your profile measurements...</span>
            </div>
          )}

          {avatarPreview && !avatarLoading && (
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() =>
                    openImageInNewTab(
                      avatarPreview.persistentUrl ?? avatarPreview.displayUrl,
                      'Regenerate the avatar to create a shareable link.'
                    )
                  }
                  className={`block w-full ${fullImageUrl ? 'cursor-zoom-in' : 'cursor-not-allowed opacity-70'}`}
                >
                  <img
                    src={avatarPreview.displayUrl}
                    alt="Personalized outfit avatar"
                    className="h-64 w-64 object-cover transition-transform duration-150 hover:scale-[1.02]"
                  />
                </button>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Personalized to your profile</p>
                <p>Generated at {avatarPreview.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="gap-2" onClick={handleDownloadAvatar} disabled={!avatarPreview}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    type="button"
                    className="gap-2"
                    onClick={handleSaveToGallery}
                    disabled={!canSaveToGallery}
                  >
                    {avatarSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                    {avatarSaving ? 'Saving...' : 'Save to gallery'}
                  </Button>
                </div>
                {avatarPreview.persistentUrl && (
                  <a
                    href={avatarPreview.persistentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    Open full image
                  </a>
                )}
                {avatarPreview.storagePath && (
                  <p className="text-xs text-slate-400" title={avatarPreview.storagePath}>
                    Storage path: {avatarPreview.storagePath}
                  </p>
                )}
                {!avatarPreview.storagePath && (
                  <p className="text-xs text-amber-600">
                    Storage upload pending - refresh the avatar to persist it for gallery saving.
                  </p>
                )}
              </div>
            </div>
          )}

          {!avatarPreview && !avatarLoading && !avatarError && (
            <p className="mt-4 text-sm text-slate-600">
              {isAuthenticated
                ? 'Generate an avatar to visualize the outfit on a body that mirrors your saved height, weight, and gender.'
                : 'Sign in to generate a personalized avatar for this outfit.'}
            </p>
          )}

          {avatarError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{avatarError}</span>
            </div>
          )}

          {profileDataIncomplete && (
            <p className="mt-4 text-xs text-slate-500">
              Tip: Add your height, weight, and gender in your profile to make avatars more accurate.
            </p>
          )}

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Saved avatar gallery</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadGallery()}
                disabled={galleryLoading || !isAuthenticated}
              >
                {galleryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-purple-500" />
                )}
                <span className="ml-2 text-xs font-medium text-slate-600">Refresh</span>
              </Button>
            </div>

            {galleryError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                <span>{galleryError}</span>
              </div>
            )}

            {galleryLoading && gallery.length === 0 && (
              <p className="text-xs text-slate-500">Loading your saved avatars...</p>
            )}

            {!galleryLoading && !galleryError && gallery.length === 0 && (
              <p className="text-xs text-slate-500">
                {isAuthenticated
                  ? 'Save favorite looks to build your personal gallery.'
                  : 'Sign in to see your saved avatars.'
                }
              </p>
            )}

            {gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {gallery.map((item) => {
                  const thumbnail = item.publicUrl
                  const created = new Date(item.createdAt)
                  return (
                    <button
                      key={item.storagePath}
                      type="button"
                      onClick={() => openImageInNewTab(thumbnail, 'This avatar is not publicly accessible yet.')}
                      className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
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
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {renderOutfitItem('Top', suggestion.top)}
              {renderOutfitItem('Bottom', suggestion.bottom)}
              {renderOutfitItem('Footwear', suggestion.footwear)}

              {suggestion.outerwear && (
                renderOutfitItem('Outerwear', suggestion.outerwear)
              )}

              {suggestion.accessories && suggestion.accessories.length > 0 && (
                <div className="space-y-3 md:col-span-2">
                  <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                    Accessories
                  </h4>
                  <div className="space-y-3">
                    {suggestion.accessories.map((accessory, index) => (
                      <div
                        key={`${accessory.summary}-${index}`}
                        className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 shadow-sm"
                      >
                        {renderOutfitItem(`Accessory ${suggestion.accessories.length > 1 ? index + 1 : ''}`.trim(), accessory)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {paletteColors.length > 0 && (
              <div className="border-t pt-4 mb-6">
                <h4 className="mb-3 font-semibold text-sm text-gray-600 uppercase tracking-wide">
                  Color Palette
                </h4>
                <div className="flex flex-wrap gap-2">
                  {paletteColors.map((color) => (
                    <span key={color} className="inline-flex items-center gap-3 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      <span
                        className="h-6 w-6 rounded-full border border-black/10"
                        style={{ backgroundColor: resolveSwatchColor(color) }}
                      />
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {suggestion.styleNotes && (
              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm text-gray-600 uppercase tracking-wide mb-2">
                  Style Notes
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {suggestion.styleNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}



