'use client'

import React, { useCallback, useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Loader2, Sparkles, AlertCircle } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import type { VendorProduct } from '@/types/vendor'
import AIAutofillSuggestions from './AIAutofillSuggestions'

interface EnhancedProductUploadProps {
  onProductCreated: (product: VendorProduct) => void
  onCancel?: () => void
}

interface ImagePreview {
  file: File
  preview: string
  id: string
}

const MAX_IMAGES = 10
const MAX_FILE_SIZE = 12 * 1024 * 1024 // 12MB

export default function EnhancedProductUpload({ onProductCreated, onCancel }: EnhancedProductUploadProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [images, setImages] = useState<ImagePreview[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    currency: 'EGP',
  })

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateAndAddFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name} is not an image file`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} is too large (max 12MB)`)
        continue
      }
      validFiles.push(file)
    }

    if (errors.length > 0) {
      toast({
        variant: 'error',
        title: 'Invalid files',
        description: errors.slice(0, 3).join(', ') + (errors.length > 3 ? ` and ${errors.length - 3} more` : ''),
      })
    }

    const remainingSlots = MAX_IMAGES - images.length
    const filesToAdd = validFiles.slice(0, remainingSlots)

    if (filesToAdd.length === 0) return

    const newImages: ImagePreview[] = filesToAdd.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: `${Date.now()}-${Math.random()}`,
    }))

    setImages((prev) => [...prev, ...newImages])

    if (validFiles.length > remainingSlots) {
      toast({
        variant: 'warning',
        title: 'Too many images',
        description: `Only the first ${remainingSlots} images were added. Maximum ${MAX_IMAGES} images allowed.`,
      })
    }
  }, [images.length, toast])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        validateAndAddFiles(files)
      }
    },
    [validateAndAddFiles],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        validateAndAddFiles(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [validateAndAddFiles],
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter((img) => img.id !== id)
    })
  }, [])

  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      const [removed] = newImages.splice(fromIndex, 1)
      newImages.splice(toIndex, 0, removed)
      return newImages
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast({
        variant: 'error',
        title: 'Title required',
        description: 'Please provide a product name.',
      })
      return
    }

    if (images.length === 0) {
      toast({
        variant: 'error',
        title: 'Images required',
        description: 'Please upload at least one product image.',
      })
      return
    }

    const price = Number.parseFloat(formData.price)
    if (Number.isNaN(price) || price < 0) {
      toast({
        variant: 'error',
        title: 'Invalid price',
        description: 'Please enter a valid price.',
      })
      return
    }

    setSubmitting(true)
    try {
      const submitFormData = new FormData()
      submitFormData.append('title', formData.title.trim())
      submitFormData.append('description', formData.description.trim())
      submitFormData.append('price', price.toString())
      submitFormData.append('currency', formData.currency)

      images.forEach((image) => {
        submitFormData.append('images', image.file)
      })

      const response = await fetch('/api/vendor/products', {
        method: 'POST',
        body: submitFormData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const errorMessage = payload?.error ?? 'Failed to create product'
        
        // If image was blocked by moderation, show specific message
        if (payload?.category && payload?.reasons) {
          const reasons = Array.isArray(payload.reasons) ? payload.reasons.join(', ') : ''
          throw new Error(
            `${errorMessage}${reasons ? `\n\nReason: ${reasons}` : ''}\n\nPlease upload appropriate product images only.`,
          )
        }
        
        throw new Error(errorMessage)
      }

      const payload = await response.json()
      
      // Clean up preview URLs
      images.forEach((img) => URL.revokeObjectURL(img.preview))

      // Reset form
      setImages([])
      setFormData({ title: '', description: '', price: '', currency: 'EGP' })

      toast({
        variant: 'success',
        title: 'Product created',
        description: 'Your product has been submitted for review.',
      })

      onProductCreated(payload.product)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create product'
      toast({
        variant: 'error',
        title: 'Upload failed',
        description: message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload New Product
        </CardTitle>
        <CardDescription>
          Drag and drop images or click to browse. Add multiple images to showcase your product from different angles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload Zone */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Images</label>
            <div
              ref={dropZoneRef}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-lg border-2 border-dashed transition-colors ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Upload className={`mb-4 h-12 w-12 ${isDragging ? 'text-emerald-600' : 'text-slate-400'}`} />
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {isDragging ? 'Drop images here' : 'Drag and drop images here'}
                </p>
                <p className="mb-4 text-xs text-slate-500">
                  or{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-emerald-600 hover:text-emerald-700 underline"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-slate-400">
                  PNG, JPG, WEBP up to 12MB each. Max {MAX_IMAGES} images.
                </p>
              </div>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {images.map((image, index) => (
                  <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {index === 0 && (
                      <div className="absolute left-2 top-2 z-10 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                        Primary
                      </div>
                    )}
                    <img
                      src={image.preview}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute right-2 top-2 z-10 rounded-full bg-rose-600 p-1.5 text-white opacity-0 transition-opacity hover:bg-rose-700 group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {index > 0 && (
                      <div className="absolute bottom-2 left-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => reorderImages(index, index - 1)}
                          className="rounded bg-white/80 px-2 py-1 text-xs font-medium text-slate-700 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        {index < images.length - 1 && (
                          <button
                            type="button"
                            onClick={() => reorderImages(index, index + 1)}
                            className="rounded bg-white/80 px-2 py-1 text-xs font-medium text-slate-700 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                          >
                            ↓
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI Autofill Suggestions */}
            {images.length > 0 && (
              <AIAutofillSuggestions
                imageUrl={images[0].preview}
                onTitleSuggestion={(title) => setFormData((prev) => ({ ...prev, title }))}
                onDescriptionSuggestion={(description) => setFormData((prev) => ({ ...prev, description }))}
              />
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Linen Wrap Dress"
                maxLength={120}
                required
              />
              <p className="text-xs text-slate-500">{formData.title.length}/120 characters</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Tell shoppers about the fit, fabric, styling ideas, and care instructions..."
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-slate-500">{formData.description.length}/2000 characters</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="price" className="text-sm font-medium">
                  Price <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="899.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="currency" className="text-sm font-medium">
                  Currency
                </label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                  placeholder="EGP"
                  maxLength={4}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={submitting || images.length === 0 || !formData.title.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Publish Product
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

