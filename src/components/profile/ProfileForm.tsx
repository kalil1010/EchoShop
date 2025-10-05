'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { ImagePlus, Trash2, Loader2, X } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { UserProfile } from '@/types/user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MultiSelectChips, type ChipOption } from '@/components/ui/multi-select-chips'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/toast'
import { COLOR_PALETTE, getHexForColorName, getNameForHex, normalizeHex } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { buildStoragePath, normaliseStoragePath, removeFromStorage, uploadToStorage } from '@/lib/storage'
import { getSupabaseClient } from '@/lib/supabaseClient'

interface ProfileFormState {
  displayName?: string
  gender?: UserProfile['gender'] | ''
  age?: number
  height?: number
  weight?: number
  favoriteColors: string[]
  favoriteStyles: string[]
  photoURL?: string
  photoPath?: string
}

const styleOptions: ChipOption[] = [
  'Casual',
  'Formal',
  'Business Casual',
  'Streetwear',
  'Sporty',
  'Bohemian',
  'Minimalist',
  'Vintage',
  'Smart Casual',
  'Chic',
].map((label) => ({ label, value: label.toLowerCase() }))

const toHexFromInput = (value: string): string | null => {
  const normalizedDirect = normalizeHex(value)
  if (normalizedDirect) return normalizedDirect
  const fromName = value ? getHexForColorName(value) : null
  if (fromName) {
    const normalizedName = normalizeHex(fromName)
    if (normalizedName) return normalizedName
  }
  return null
}

function normaliseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normaliseDisplayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function ProfileForm() {
  const { userProfile, updateUserProfile } = useAuth()
  const { toast } = useToast()

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (error) {
      console.error('Supabase client initialisation failed:', error)
      return null
    }
  }, [])

  const [formData, setFormData] = useState<ProfileFormState>({
    displayName: undefined,
    gender: undefined,
    age: undefined,
    height: undefined,
    weight: undefined,
    favoriteColors: [],
    favoriteStyles: [],
    photoURL: undefined,
  })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [customColorPicker, setCustomColorPicker] = useState('#6b7280')
  const [customColorText, setCustomColorText] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const paletteColors = useMemo(() => {
    const seen = new Set<string>()
    return COLOR_PALETTE.map((color) => ({
      name: color.name,
      hex: normalizeHex(color.hex) ?? color.hex.toUpperCase(),
    })).filter((color) => {
      if (seen.has(color.hex)) return false
      seen.add(color.hex)
      return true
    })
  }, [])

  const prepareFavoriteColors = useCallback((values?: string[]) => {
    const unique = new Set<string>()
    values?.forEach((value) => {
      const hex = toHexFromInput(value)
      if (hex) unique.add(hex)
    })
    return Array.from(unique)
  }, [])

  useEffect(() => {
    if (!userProfile) return
    setFormData({
      displayName: userProfile.displayName ?? undefined,
      gender: userProfile.gender ?? undefined,
      age: userProfile.age ?? undefined,
      height: userProfile.height ?? undefined,
      weight: userProfile.weight ?? undefined,
      favoriteColors: prepareFavoriteColors(userProfile.favoriteColors),
      favoriteStyles: userProfile.favoriteStyles ?? [],
      photoURL: userProfile.photoURL ?? undefined,
      photoPath: userProfile.photoPath ?? undefined,
    })
    setPreviewUrl(null)
  }, [prepareFavoriteColors, userProfile])

  const updateFavoriteColors = useCallback((updater: (current: string[]) => string[]) => {
    setFormData((prev) => {
      const current = prev.favoriteColors ?? []
      const next = updater(current)
      return { ...prev, favoriteColors: next }
    })
  }, [])

  const addFavoriteColor = useCallback((value: string) => {
    const hex = toHexFromInput(value)
    if (!hex) {
      toast({ variant: 'error', title: 'Invalid color', description: 'Enter a valid hex (e.g. #3B82F6) or known color name.' })
      return
    }
    updateFavoriteColors((current) => (current.includes(hex) ? current : [...current, hex]))
  }, [updateFavoriteColors, toast])

  const removeFavoriteColor = useCallback((value: string) => {
    const hex = normalizeHex(value)
    if (!hex) return
    updateFavoriteColors((current) => current.filter((entry) => entry !== hex))
  }, [updateFavoriteColors])

  const handleAddCustomColor = useCallback(() => {
    if (customColorText.trim()) {
      addFavoriteColor(customColorText)
      setCustomColorText('')
      return
    }
    if (customColorPicker) {
      addFavoriteColor(customColorPicker)
    }
  }, [addFavoriteColor, customColorPicker, customColorText])

  const selectedColors = useMemo(() => {
    const seen = new Set<string>()
    return (formData.favoriteColors ?? [])
      .map((value) => normalizeHex(value))
      .filter((hex): hex is string => Boolean(hex))
      .filter((hex) => {
        if (seen.has(hex)) return false
        seen.add(hex)
        return true
      })
      .map((hex) => ({
        hex,
        name: getNameForHex(hex) ?? hex,
      }))
  }, [formData.favoriteColors])

  const selectedColorSet = useMemo(() => new Set(selectedColors.map((color) => color.hex)), [selectedColors])

  const handleInputChange = (field: keyof ProfileFormState, value: unknown) => {
    setFormData((prev) => {
      if (field === 'gender') {
        const next = typeof value === 'string' && value ? (value as UserProfile['gender']) : undefined
        return { ...prev, gender: next }
      }

      if (field === 'age' || field === 'height' || field === 'weight') {
        return { ...prev, [field]: normaliseNumber(value) }
      }

      if (field === 'displayName') {
        return { ...prev, displayName: typeof value === 'string' ? value : undefined }
      }

      if (field === 'favoriteStyles') {
        return { ...prev, favoriteStyles: Array.isArray(value) ? (value as string[]) : [] }
      }

      if (field === 'photoURL') {
        return { ...prev, photoURL: typeof value === 'string' ? value : undefined }
      }

      return prev
    })
  }

  const uniqueFavoriteColors = useMemo(() => {
    return Array.from(
      new Set(
        (formData.favoriteColors ?? [])
          .map((value) => normalizeHex(value))
          .filter((hex): hex is string => Boolean(hex)),
      ),
    )
  }, [formData.favoriteColors])

  const buildUpdatePayload = (): Partial<UserProfile> => ({
    displayName: normaliseDisplayName(formData.displayName),
    gender: formData.gender || undefined,
    age: normaliseNumber(formData.age),
    height: normaliseNumber(formData.height),
    weight: normaliseNumber(formData.weight),
    favoriteColors: uniqueFavoriteColors,
    favoriteStyles: formData.favoriteStyles,
    photoURL: formData.photoURL || undefined,
    photoPath: formData.photoPath || undefined,
    updatedAt: new Date(),
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = buildUpdatePayload()
      await updateUserProfile(payload)
      if (supabase) {
        try {
          await supabase.auth.updateUser({ data: { display_name: payload.displayName ?? null } })
        } catch (error) {
          console.warn('Failed to sync Supabase auth profile:', error)
        }
      }
      toast({ variant: 'success', title: 'Profile updated' })
    } catch (error) {
      console.error('Failed to update profile:', error)
      toast({ variant: 'error', title: 'Failed to update profile' })
    } finally {
      setLoading(false)
    }
  }

  const resizeImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const img = new Image()
        img.onload = () => {
          const maxSize = 384
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(img.width * ratio)
          canvas.height = Math.round(img.height * ratio)
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Canvas not supported'))
            return
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Could not create image blob'))
            },
            'image/webp',
            0.75,
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })

  const handlePhotoSelected = async (file: File) => {
    const uid = userProfile?.uid
    if (!uid || !supabase) {
      toast({ variant: 'error', title: 'Unable to upload', description: 'Please sign in before uploading a photo.' })
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const resized = await resizeImage(file)
      const previewObjectUrl = URL.createObjectURL(resized)
      setPreviewUrl(previewObjectUrl)

      const storagePath = buildStoragePath({ userId: uid, originalName: 'profile.webp', folder: 'profiles' })
      const result = await uploadToStorage(storagePath, resized, { contentType: 'image/webp', cacheControl: '3600', upsert: true })

      const previousPath = formData.photoPath || userProfile?.photoPath
      if (previousPath && normaliseStoragePath(previousPath) !== normaliseStoragePath(storagePath)) {
        try {
          await removeFromStorage(previousPath)
        } catch (err) {
          console.warn('Failed to delete previous profile photo:', err)
        }
      }

      setFormData((prev) => ({ ...prev, photoURL: result.publicUrl, photoPath: storagePath }))
      await updateUserProfile({ photoURL: result.publicUrl, photoPath: storagePath, updatedAt: new Date() })
      setUploadProgress(100)
      toast({ variant: 'success', title: 'Profile photo updated' })
    } catch (error) {
      console.error('Failed to upload profile image:', error)
      const description = error instanceof Error ? error.message : 'Failed to upload profile image. Please try again.'
      toast({ variant: 'error', title: 'Upload failed', description })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }


  const handleRemovePhoto = async () => {
    if (!supabase || !userProfile?.uid) {
      toast({ variant: 'error', title: 'Unable to remove photo', description: 'You must be signed in.' })
      return
    }

    try {
      const currentPath = formData.photoPath || userProfile?.photoPath
      if (currentPath) {
        try {
          await removeFromStorage(currentPath)
        } catch (error) {
          console.warn('Failed to delete stored photo:', error)
        }
      }

      setFormData((prev) => ({ ...prev, photoURL: undefined, photoPath: undefined }))
      setPreviewUrl(null)
      await updateUserProfile({ photoURL: undefined, photoPath: undefined, updatedAt: new Date() })
      toast({ variant: 'success', title: 'Profile photo removed' })
    } catch (error) {
      console.error('Failed to remove profile photo:', error)
      toast({ variant: 'error', title: 'Failed to remove photo' })
    }
  }


  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
        <CardDescription>Update your personal information and style preferences</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">Profile Image</label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={previewUrl || formData.photoURL || ''} />
                <AvatarFallback>{(formData.displayName?.[0] || 'U').toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      setPreviewUrl(URL.createObjectURL(file))
                      void handlePhotoSelected(file)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-gray-700 hover:bg-gray-50"
                  title="Change photo"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploading || (!previewUrl && !formData.photoURL)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border text-gray-700 hover:bg-gray-50"
                  title="Remove photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {uploading && (
                  <span className="text-sm text-gray-500">Uploading... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                Display Name
              </label>
              <Input
                id="displayName"
                value={formData.displayName ?? ''}
                onChange={(event) => handleInputChange('displayName', event.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="gender" className="text-sm font-medium">
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender ?? ''}
                onChange={(event) => handleInputChange('gender', event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="age" className="text-sm font-medium">
                Age
              </label>
              <Input
                id="age"
                inputMode="numeric"
                value={formData.age ?? ''}
                onChange={(event) => handleInputChange('age', event.target.value)}
                placeholder="Your age"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="height" className="text-sm font-medium">
                Height (cm)
              </label>
              <Input
                id="height"
                inputMode="numeric"
                value={formData.height ?? ''}
                onChange={(event) => handleInputChange('height', event.target.value)}
                placeholder="Height in cm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="weight" className="text-sm font-medium">
              Weight (kg)
            </label>
            <Input
              id="weight"
              inputMode="numeric"
              value={formData.weight ?? ''}
              onChange={(event) => handleInputChange('weight', event.target.value)}
              placeholder="Weight in kg"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Favorite Colors</label>
              {selectedColors.length > 0 && (
                <span className="text-xs text-gray-500">Tap a swatch to remove it</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedColors.length === 0 ? (
                <span className="text-sm text-gray-500">No favorite colors selected.</span>
              ) : (
                selectedColors.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => removeFavoriteColor(color.hex)}
                    className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-purple-500 hover:text-purple-600"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10 shadow"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden
                    />
                    <span>{color.name}</span>
                    <X className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-500" aria-hidden />
                    <span className="sr-only">Remove {color.name}</span>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-lg border border-dashed border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Palette</p>
                <span className="text-xs text-gray-400">Choose up to {Math.max(0, 12 - selectedColors.length)} more</span>
              </div>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-8">
                  {paletteColors.map((color) => {
                    const isSelected = selectedColorSet.has(color.hex)
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => addFavoriteColor(color.hex)}
                        disabled={isSelected}
                        className={cn(
                          'group flex flex-col items-center gap-1 rounded-md border border-transparent p-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
                          isSelected
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:-translate-y-1 hover:bg-purple-50',
                        )}
                        title={`${color.name} (${color.hex})`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="h-8 w-8 rounded-full border border-black/10 shadow-sm"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-[11px] text-gray-600 group-hover:text-gray-900">{color.name}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-md border border-gray-200 bg-white/60 p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add custom color</p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <div className="flex w-full items-center gap-2">
                      <input
                        type="color"
                        aria-label="Pick a custom color"
                        value={customColorPicker}
                        onChange={(event) => setCustomColorPicker(event.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-md border border-gray-200 bg-white shadow-sm"
                      />
                      <Input
                        value={customColorText}
                        onChange={(event) => setCustomColorText(event.target.value)}
                        placeholder="#RRGGBB or color name"
                        className="flex-1"
                        spellCheck={false}
                      />
                    </div>
                    <Button type="button" variant="outline" className="sm:w-auto" onClick={handleAddCustomColor}>
                      Add Color
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Tip: paste a hex like <code>#3B82F6</code> or type a color name such as "sage".
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Favorite Styles</label>
            <MultiSelectChips
              options={styleOptions}
              value={formData.favoriteStyles}
              onChange={(values) => handleInputChange('favoriteStyles', values)}
              allowCustom
              customPlaceholder="Add a style (e.g., athleisure)"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

