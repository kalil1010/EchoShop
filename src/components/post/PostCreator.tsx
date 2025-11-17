'use client'

import React, { useState, useCallback, useRef } from 'react'
import { X, Upload, Image as ImageIcon, Loader2, Lock, Users, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
// Using inline modal pattern similar to ItemDetailModal
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import type { Post, PostPrivacyLevel, CreatePostInput, OutfitData } from '@/types/post'

interface PostCreatorProps {
  open: boolean
  onClose: () => void
  onPostCreated?: (post: Post) => void
  initialOutfitData?: OutfitData
  initialImages?: string[]
  initialCaption?: string
}

export function PostCreator({
  open,
  onClose,
  onPostCreated,
  initialOutfitData,
  initialImages = [],
  initialCaption = '',
}: PostCreatorProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [caption, setCaption] = useState(initialCaption)
  const [privacyLevel, setPrivacyLevel] = useState<PostPrivacyLevel>('public')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (files.length + images.length > 10) {
      toast({
        variant: 'error',
        title: 'Too many images',
        description: 'Maximum 10 images allowed per post.',
      })
      return
    }

    const newImages: File[] = []
    const newPreviews: string[] = []

    files.forEach((file) => {
      if (file.size > 12 * 1024 * 1024) {
        toast({
          variant: 'error',
          title: 'Image too large',
          description: `${file.name} is larger than 12MB. Please choose a smaller image.`,
        })
        return
      }

      newImages.push(file)
      const previewUrl = URL.createObjectURL(file)
      newPreviews.push(previewUrl)
    })

    setImages((prev) => [...prev, ...newImages])
    setImagePreviews((prev) => [...prev, ...newPreviews])
  }, [images.length, toast])

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      newImages.splice(index, 1)
      return newImages
    })
    setImagePreviews((prev) => {
      const preview = prev[index]
      if (preview && !initialImages.includes(preview)) {
        URL.revokeObjectURL(preview)
      }
      const newPreviews = [...prev]
      newPreviews.splice(index, 1)
      return newPreviews
    })
  }, [initialImages])

  const handleCreatePost = useCallback(async () => {
    if (!user) {
      toast({
        variant: 'error',
        title: 'Sign in required',
        description: 'Please sign in to create a post.',
      })
      return
    }

    if (images.length === 0 && imagePreviews.length === 0) {
      toast({
        variant: 'error',
        title: 'Images required',
        description: 'Please add at least one image to your post.',
      })
      return
    }

    setCreating(true)

    try {
      // Get access token
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired. Please sign in again.')
      }

      let uploadedImages: string[] = []
      let uploadedPaths: string[] = []

      // Upload new images if any
      if (images.length > 0) {
        setUploading(true)
        const formData = new FormData()
        images.forEach((file) => {
          formData.append('images', file)
        })

        const uploadResponse = await fetch('/api/posts/upload-images', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to upload images')
        }

        const uploadData = await uploadResponse.json()
        uploadedImages = uploadData.images || []
        uploadedPaths = uploadData.imagePaths || []
        setUploading(false)
      } else {
        // Use initial images (already uploaded)
        uploadedImages = initialImages
        uploadedPaths = [] // Paths not needed for initial images
      }

      // Create post
      const postData: CreatePostInput = {
        caption: caption.trim() || undefined,
        images: uploadedImages,
        imagePaths: uploadedPaths,
        outfitData: initialOutfitData,
        privacyLevel,
      }

      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(postData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create post')
      }

      const { post } = await response.json()
      onPostCreated?.(post)

      toast({
        variant: 'success',
        title: 'Post created',
        description: 'Your post has been shared successfully!',
      })

      // Reset form
      setCaption('')
      setImages([])
      setImagePreviews([])
      setPrivacyLevel('public')
      onClose()
    } catch (error) {
      console.error('[PostCreator] Error:', error)
      toast({
        variant: 'error',
        title: 'Failed to create post',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setCreating(false)
      setUploading(false)
    }
  }, [user, images, imagePreviews, initialImages, caption, privacyLevel, initialOutfitData, toast, onPostCreated, onClose])

  const handleClose = useCallback(() => {
    // Cleanup preview URLs
    imagePreviews.forEach((preview) => {
      if (!initialImages.includes(preview)) {
        URL.revokeObjectURL(preview)
      }
    })
    setCaption('')
    setImages([])
    setImagePreviews(initialImages)
    setPrivacyLevel('public')
    onClose()
  }, [imagePreviews, initialImages, onClose])

  const totalImages = imagePreviews.length

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Post</h2>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-6">

        <div className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Images</label>
            <div className="grid grid-cols-3 gap-2">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {totalImages < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 flex items-center justify-center bg-gray-50"
                >
                  <Upload className="h-6 w-6 text-gray-400" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's on your mind? Use #hashtags to tag your post..."
              rows={4}
              maxLength={2000}
            />
            <div className="text-xs text-gray-500 text-right">
              {caption.length}/2000
            </div>
          </div>

          {/* Privacy Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Privacy</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrivacyLevel('public')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                  privacyLevel === 'public'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Globe className="h-4 w-4" />
                Public
              </button>
              <button
                type="button"
                onClick={() => setPrivacyLevel('followers')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                  privacyLevel === 'followers'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users className="h-4 w-4" />
                Followers
              </button>
              <button
                type="button"
                onClick={() => setPrivacyLevel('private')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border ${
                  privacyLevel === 'private'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Lock className="h-4 w-4" />
                Private
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClose} disabled={creating || uploading}>
              Cancel
            </Button>
            <Button
              onClick={handleCreatePost}
              disabled={creating || uploading || (totalImages === 0)}
            >
              {(creating || uploading) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? 'Uploading...' : 'Creating...'}
                </>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

