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
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { useToast } from '@/components/ui/toast'
import { COLOR_PALETTE, getHexForColorName, getNameForHex, normalizeHex } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { buildStoragePath, normaliseStoragePath, removeFromStorage, uploadToStorage } from '@/lib/storage'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { BodyShapeSelector, getBodyShapeOptionsForGender } from '@/components/profile/BodyShapeSelector'

interface ProfileFormState {
  displayName?: string
  gender?: UserProfile['gender'] | ''
  age?: number
  height?: number
  weight?: number
  bodyShape?: string
  footSize?: string
  favoriteColors: string[]
  dislikedColors: string[]
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

const FOOT_SIZE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'EU-36', label: 'EU 36' },
  { value: 'EU-37', label: 'EU 37' },
  { value: 'EU-38', label: 'EU 38' },
  { value: 'EU-39', label: 'EU 39' },
  { value: 'EU-40', label: 'EU 40' },
  { value: 'EU-41', label: 'EU 41' },
  { value: 'EU-42', label: 'EU 42' },
  { value: 'EU-43', label: 'EU 43' },
  { value: 'EU-44', label: 'EU 44' },
  { value: 'EU-45', label: 'EU 45' },
  { value: 'EU-46', label: 'EU 46' },
  { value: 'USW-5', label: 'US Women 5' },
  { value: 'USW-6', label: 'US Women 6' },
  { value: 'USW-7', label: 'US Women 7' },
  { value: 'USW-8', label: 'US Women 8' },
  { value: 'USW-9', label: 'US Women 9' },
  { value: 'USW-10', label: 'US Women 10' },
  { value: 'USW-11', label: 'US Women 11' },
  { value: 'USW-12', label: 'US Women 12' },
  { value: 'USM-6', label: 'US Men 6' },
  { value: 'USM-7', label: 'US Men 7' },
  { value: 'USM-8', label: 'US Men 8' },
  { value: 'USM-9', label: 'US Men 9' },
  { value: 'USM-10', label: 'US Men 10' },
  { value: 'USM-11', label: 'US Men 11' },
  { value: 'USM-12', label: 'US Men 12' },
  { value: 'USM-13', label: 'US Men 13' },
]
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
  const { user, userProfile, updateUserProfile } = useAuth()
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
    bodyShape: undefined,
    footSize: undefined,
    favoriteColors: [],
    dislikedColors: [],
    favoriteStyles: [],
    photoURL: undefined,
  })
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [customColorPicker, setCustomColorPicker] = useState('#6b7280')
  const [customColorText, setCustomColorText] = useState('')
  const [customDislikedColorPicker, setCustomDislikedColorPicker] = useState('#d1d5db')
  const [customDislikedColorText, setCustomDislikedColorText] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cropFileRef = useRef<File | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const clearCropSource = useCallback(() => {
    setCropSource((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    cropFileRef.current = null
    setIsCropOpen(false)
  }, [])
  const handleCropCancel = useCallback(() => {
    clearCropSource()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [clearCropSource])

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

  const prepareColorList = useCallback((values?: string[]) => {
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
      bodyShape: userProfile.bodyShape ?? undefined,
      footSize: userProfile.footSize ?? undefined,
      favoriteColors: prepareColorList(userProfile.favoriteColors),
      dislikedColors: prepareColorList(userProfile.dislikedColors),
      favoriteStyles: userProfile.favoriteStyles ?? [],
      photoURL: userProfile.photoURL ?? undefined,
      photoPath: userProfile.photoPath ?? undefined,
    })
    setPreviewUrl(null)
  }, [prepareColorList, userProfile])

  const updateDislikedColors = useCallback((updater: (current: string[]) => string[]) => {
    setFormData((prev) => {
      const current = prev.dislikedColors ?? []
      const next = updater(current)
      return { ...prev, dislikedColors: next }
    })
  }, [])

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
    updateDislikedColors((current) => current.filter((entry) => entry !== hex))
    updateFavoriteColors((current) => (current.includes(hex) ? current : [...current, hex]))
  }, [toast, updateDislikedColors, updateFavoriteColors])

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

  const addDislikedColor = useCallback((value: string) => {
    const hex = toHexFromInput(value)
    if (!hex) {
      toast({ variant: 'error', title: 'Invalid color', description: 'Enter a valid hex (e.g. #F97316) or known color name.' })
      return
    }
    updateFavoriteColors((current) => current.filter((entry) => entry !== hex))
    updateDislikedColors((current) => (current.includes(hex) ? current : [...current, hex]))
  }, [toast, updateDislikedColors, updateFavoriteColors])

  const removeDislikedColor = useCallback((value: string) => {
    const hex = normalizeHex(value)
    if (!hex) return
    updateDislikedColors((current) => current.filter((entry) => entry !== hex))
  }, [updateDislikedColors])

  const handleAddCustomDislikedColor = useCallback(() => {
    if (customDislikedColorText.trim()) {
      addDislikedColor(customDislikedColorText)
      setCustomDislikedColorText('')
      return
    }
    if (customDislikedColorPicker) {
      addDislikedColor(customDislikedColorPicker)
    }
  }, [addDislikedColor, customDislikedColorPicker, customDislikedColorText])

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

  const selectedDislikedColors = useMemo(() => {
    const seen = new Set<string>()
    return (formData.dislikedColors ?? [])
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
  }, [formData.dislikedColors])

  const selectedDislikedColorSet = useMemo(
    () => new Set(selectedDislikedColors.map((color) => color.hex)),
    [selectedDislikedColors],
  )

  const handleInputChange = (field: keyof ProfileFormState, value: unknown) => {
    setFormData((prev) => {
      if (field === 'gender') {
        const nextGender = typeof value === 'string' && value ? (value as UserProfile['gender']) : undefined
        const availableShapes = getBodyShapeOptionsForGender(nextGender)
        const currentShape = prev.bodyShape
        const shapeIsValid = currentShape ? availableShapes.some((option) => option.id === currentShape) : true
        return {
          ...prev,
          gender: nextGender,
          bodyShape: shapeIsValid ? currentShape : undefined,
        }
      }

      if (field === 'age' || field === 'height' || field === 'weight') {
        return { ...prev, [field]: normaliseNumber(value) }
      }

      if (field === 'displayName') {
        return { ...prev, displayName: typeof value === 'string' ? value : undefined }
      }

      if (field === 'bodyShape') {
        return {
          ...prev,
          bodyShape: typeof value === 'string' && value ? value : undefined,
        }
      }

      if (field === 'footSize') {
        return {
          ...prev,
          footSize: typeof value === 'string' && value ? value : undefined,
        }
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

  const uniqueDislikedColors = useMemo(() => {
    return Array.from(
      new Set(
        (formData.dislikedColors ?? [])
          .map((value) => normalizeHex(value))
          .filter((hex): hex is string => Boolean(hex)),
      ),
    )
  }, [formData.dislikedColors])

const buildUpdatePayload = (): Partial<UserProfile> => ({
    displayName: normaliseDisplayName(formData.displayName),
    gender: formData.gender || undefined,
    age: normaliseNumber(formData.age),
    height: normaliseNumber(formData.height),
    weight: normaliseNumber(formData.weight),
    bodyShape: formData.bodyShape || undefined,
    footSize: formData.footSize || undefined,
    favoriteColors: uniqueFavoriteColors,
    dislikedColors: uniqueDislikedColors,
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

  const handlePhotoSelected = useCallback(async (file: File) => {
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
      const ownerId = user?.uid ?? userProfile?.uid
      if (!ownerId) {
        throw new Error('Unable to determine profile owner for upload.')
      }
      const result = await uploadToStorage(storagePath, resized, { contentType: 'image/webp', cacheControl: '3600', upsert: true, ownerId })

      const previousPath = formData.photoPath || userProfile?.photoPath
      if (previousPath && normaliseStoragePath(previousPath) !== normaliseStoragePath(storagePath)) {
        try {
          await removeFromStorage(previousPath, { ownerId })
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
  }, [
    formData.photoPath,
    supabase,
    toast,
    updateUserProfile,
    user?.uid,
    userProfile,
  ])


  const handleCropComplete = useCallback((croppedFile: File, previewUrl: string) => {
    clearCropSource()
    setPreviewUrl(previewUrl)
    void handlePhotoSelected(croppedFile)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [clearCropSource, handlePhotoSelected])


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
    <>
      <ImageCropDialog
        open={isCropOpen && !!cropSource && !!cropFileRef.current}
        imageSrc={cropSource}
        originalFile={cropFileRef.current}
        aspect={1}
        title="Crop profile photo"
        onCancel={handleCropCancel}
        onComplete={handleCropComplete}
      />
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
                    if (!file) return
                    clearCropSource()
                    cropFileRef.current = file
                    setCropSource(URL.createObjectURL(file))
                    setIsCropOpen(true)
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
                name="displayName"
                value={formData.displayName ?? ''}
                onChange={(event) => handleInputChange('displayName', event.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="gender" className="text-sm font-medium">
                Gender
              </label>
              <select
                id="gender"
                name="gender"
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
                name="age"
                type="number"
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
                name="height"
                type="number"
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
              name="weight"
              type="number"
              inputMode="numeric"
              value={formData.weight ?? ''}
              onChange={(event) => handleInputChange('weight', event.target.value)}
              placeholder="Weight in kg"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">Body Shape</label>
            <BodyShapeSelector
              gender={formData.gender || undefined}
              value={formData.bodyShape}
              onChange={(shape) => handleInputChange('bodyShape', shape || undefined)}
            />
            <p className="text-xs text-gray-500">
              Choose the silhouette that best reflects your frame. Options adjust based on your selected gender.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="foot-size" className="text-sm font-medium">
              Foot Size
            </label>
            <select
              id="foot-size"
              name="footSize"
              value={formData.footSize ?? ''}
              onChange={(event) => handleInputChange('footSize', event.target.value || undefined)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select your common shoe size</option>
              {FOOT_SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">We use this to recommend better-fitting footwear.</p>
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
                    Tip: paste a hex like <code>#3B82F6</code> or type a color name such as &quot;sage&quot;.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Colors to Avoid</label>
              {selectedDislikedColors.length > 0 && (
                <span className="text-xs text-gray-500">Tap a swatch to remove it</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedDislikedColors.length === 0 ? (
                <span className="text-sm text-gray-500">No disliked colors yet.</span>
              ) : (
                selectedDislikedColors.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => removeDislikedColor(color.hex)}
                    className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition hover:border-rose-400 hover:text-rose-500"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10 shadow"
                      style={{ backgroundColor: color.hex }}
                      aria-hidden
                    />
                    <span>{color.name}</span>
                    <X className="h-3.5 w-3.5 text-gray-400 group-hover:text-rose-500" aria-hidden />
                    <span className="sr-only">Remove {color.name}</span>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-lg border border-dashed border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mark colours to downplay</p>
                <span className="text-xs text-gray-400">Avoid up to {Math.max(0, 8 - selectedDislikedColors.length)} shades</span>
              </div>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-8">
                  {paletteColors.map((color) => {
                    const isSelected = selectedDislikedColorSet.has(color.hex)
                    return (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => addDislikedColor(color.hex)}
                        disabled={isSelected}
                        className={cn(
                          'group flex flex-col items-center gap-1 rounded-md border border-transparent p-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1',
                          isSelected
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:-translate-y-1 hover:bg-rose-50',
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Add custom colour</p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                    <div className="flex w-full items-center gap-2">
                      <input
                        type="color"
                        aria-label="Pick a colour to avoid"
                        value={customDislikedColorPicker}
                        onChange={(event) => setCustomDislikedColorPicker(event.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-md border border-gray-200 bg-white shadow-sm"
                      />
                      <Input
                        value={customDislikedColorText}
                        onChange={(event) => setCustomDislikedColorText(event.target.value)}
                        placeholder="#RRGGBB or colour name"
                        className="flex-1"
                        spellCheck={false}
                      />
                    </div>
                    <Button type="button" variant="outline" className="sm:w-auto" onClick={handleAddCustomDislikedColor}>
                      Add Colour
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    We&rsquo;ll downplay these shades when building outfits for you.
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
    </>
  )
}

