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
import { generateImage, getOutfitSuggestion, OutfitPieceRecommendation, OutfitSuggestionResponse } from '@/lib/api'
import { WeatherData } from '@/lib/weather'
import { AlertTriangle, Image as ImageIcon, Loader2, Shirt, Sparkles, Zap } from 'lucide-react'
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
  const { user, userProfile } = useAuth()
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
      if (!user?.uid) {
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
  }, [user?.uid])

  const triggerAvatarGeneration = useCallback(
    async (outfit: OutfitSuggestionResponse, occasionLabel: string, weatherSnapshot: WeatherData | null) => {
      if (!occasionLabel) return

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

        const response = await generateImage({
          purpose: 'avatar',
          outfit,
          profile: profileInput,
          context: contextPayload,
          metadata: {
            source: 'outfit-suggestion',
            userId: user?.uid ?? null,
            location: weatherSnapshot?.location ?? null,
          },
        })

        const objectUrl = URL.createObjectURL(response.blob)
        avatarObjectUrlRef.current = objectUrl
        const displayUrl = response.avatarUrl ?? objectUrl

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
    [clearAvatarObjectUrl, toast, user?.uid, userProfile]
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

  const canRefreshAvatar = Boolean(suggestion && weather && (occasion || selectedOccasions[0]))

  const handleAvatarRefresh = useCallback(() => {
    if (!suggestion || !weather) return
    const occ = occasion || selectedOccasions[0] || ''
    if (!occ) return
    void triggerAvatarGeneration(suggestion, occ, weather)
  }, [occasion, selectedOccasions, suggestion, triggerAvatarGeneration, weather])

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

          {avatarLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              <span>Tailoring the outfit to your profile measurements...</span>
            </div>
          )}

          {avatarPreview && !avatarLoading && (
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img
                  src={avatarPreview.displayUrl}
                  alt="Personalized outfit avatar"
                  className="h-64 w-64 object-cover"
                />
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p className="font-medium text-slate-800">Personalized to your profile</p>
                <p>Generated at {avatarPreview.generatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</p>
                <p className="text-xs text-slate-500">
                  Face references are approximated today. We will blend your uploaded photo automatically once Mistral enables image conditioning.
                </p>
                {avatarPreview.persistentUrl && (
                  <a
                    href={avatarPreview.persistentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    Open stored image
                  </a>
                )}
                {avatarPreview.storagePath && (
                  <p className="text-xs text-slate-400" title={avatarPreview.storagePath}>
                    Storage path: {avatarPreview.storagePath}
                  </p>
                )}
              </div>
            </div>
          )}

          {!avatarPreview && !avatarLoading && !avatarError && (
            <p className="mt-4 text-sm text-slate-600">
              Generate an avatar to visualise the outfit on a body that mirrors your saved height, weight, and gender.
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

