'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

import { Button } from '@/components/ui/button'
import { getCroppedBlob, type CropAreaPixels } from '@/lib/cropImage'

interface ImageCropDialogProps {
  open: boolean
  imageSrc: string | null
  originalFile: File | null
  aspect?: number
  title?: string
  onCancel: () => void
  onComplete: (file: File, previewUrl: string) => void
}

function toCropAreaPixels(area: Area | null): CropAreaPixels | null {
  if (!area) return null
  return {
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
  }
}

export function ImageCropDialog({ open, imageSrc, originalFile, aspect, title = 'Crop image', onCancel, onComplete }: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
    }
  }, [open, imageSrc])

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(toCropAreaPixels(areaPixels))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || !originalFile) return
    const area = croppedAreaPixels
    if (!area) {
      return
    }
    setProcessing(true)
    try {
      const blob = await getCroppedBlob(imageSrc, area, originalFile.type || 'image/jpeg')
      const baseName = originalFile.name.replace(/\.[^/.]+$/, '')
      const ext = originalFile.name.split('.').pop() || 'jpg'
      const croppedFile = new File([blob], `${baseName}-cropped.${ext}`, {
        type: originalFile.type || 'image/jpeg',
        lastModified: Date.now(),
      })
      const previewUrl = URL.createObjectURL(croppedFile)
      onComplete(croppedFile, previewUrl)
    } catch (error) {
      console.error('Failed to crop image', error)
    } finally {
      setProcessing(false)
    }
  }, [croppedAreaPixels, imageSrc, originalFile, onComplete])

  if (!open || !imageSrc || !originalFile) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">Adjust the crop area, then click Apply.</p>
        </div>
        <div className="relative h-[60vh] max-h-[480px] bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            showGrid
            objectFit="contain"
          />
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <label className="text-sm text-gray-600" htmlFor="crop-zoom">
            Zoom
          </label>
          <input
            id="crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={processing || !croppedAreaPixels}>
              {processing ? 'Cropping...' : 'Apply crop'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
