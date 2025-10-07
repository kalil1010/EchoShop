'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
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

type AspectPreset = { label: string; value: number | 'free' }

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
  const [selectedAspect, setSelectedAspect] = useState<number | undefined>(aspect)
  const aspectPresets = useMemo<AspectPreset[]>(() => {
    if (typeof aspect === 'number') {
      return []
    }
    return [
      { label: 'Free', value: 'free' },
      { label: 'Square', value: 1 },
      { label: '4:5 Portrait', value: 4 / 5 },
      { label: '3:4 Portrait', value: 3 / 4 },
      { label: '16:9 Landscape', value: 16 / 9 },
    ]
  }, [aspect])
  const effectiveAspect = typeof aspect === 'number' ? aspect : selectedAspect

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setSelectedAspect(typeof aspect === 'number' ? aspect : undefined)
    }
  }, [open, imageSrc, aspect])

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(toCropAreaPixels(areaPixels))
  }, [])
  const handleAspectChange = useCallback((value: number | 'free') => {
    setSelectedAspect(value === 'free' ? undefined : value)
    setZoom(1)
    setCroppedAreaPixels(null)
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
            aspect={effectiveAspect ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            showGrid
            objectFit="contain"
          />
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          {aspectPresets.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-gray-600">Aspect ratio</span>
              <div className="flex flex-wrap gap-2">
                {aspectPresets.map((option) => {
                  const isActive = option.value === 'free' ? !selectedAspect : selectedAspect === option.value
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleAspectChange(option.value)}
                      className={`rounded border px-3 py-1 text-xs font-medium transition-colors ${isActive ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-300 text-gray-600 hover:border-purple-400 hover:text-purple-600'}`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
