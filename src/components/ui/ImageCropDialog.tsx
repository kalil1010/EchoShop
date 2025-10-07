'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'

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

const MIN_SELECTION_PX = 80
const PADDING_RATIO = 0.14
const CROP_CONTAINER_MAX_WIDTH = 520
const CROP_CONTAINER_MAX_HEIGHT = 600
const CROP_CONTAINER_MIN_HEIGHT = 320

function clampCropValue(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

function createInitialCrop(displayWidth: number, displayHeight: number, aspect?: number): Crop {
  const usableWidth = Math.max(displayWidth * (1 - PADDING_RATIO * 2), MIN_SELECTION_PX)
  const usableHeight = Math.max(displayHeight * (1 - PADDING_RATIO * 2), MIN_SELECTION_PX)

  let width = usableWidth
  let height = usableHeight

  if (aspect && aspect > 0) {
    width = usableWidth
    height = width / aspect
    if (height > usableHeight) {
      height = usableHeight
      width = height * aspect
    }
  }

  width = clampCropValue(width, MIN_SELECTION_PX, displayWidth)
  height = clampCropValue(height, MIN_SELECTION_PX, displayHeight)

  const x = clampCropValue((displayWidth - width) / 2, 0, displayWidth - width)
  const y = clampCropValue((displayHeight - height) / 2, 0, displayHeight - height)

  return {
    unit: 'px',
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function cropToPixelCrop(crop: Crop | null): PixelCrop | null {
  if (!crop || !crop.width || !crop.height) {
    return null
  }
  return {
    unit: 'px',
    x: Math.max(0, Math.round(crop.x ?? 0)),
    y: Math.max(0, Math.round(crop.y ?? 0)),
    width: Math.max(1, Math.round(crop.width ?? 0)),
    height: Math.max(1, Math.round(crop.height ?? 0)),
  }
}

export function ImageCropDialog({ open, imageSrc, originalFile, aspect, title = 'Crop image', onCancel, onComplete }: ImageCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const imageMetricsRef = useRef<{ naturalWidth: number; naturalHeight: number; displayWidth: number; displayHeight: number } | null>(null)
  const [crop, setCrop] = useState<Crop>({ unit: 'px', x: 0, y: 0, width: 0, height: 0 })
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null)
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

  useEffect(() => {
    if (open) {
      setProcessing(false)
      setCompletedCrop(null)
      setCrop({ unit: 'px', x: 0, y: 0, width: 0, height: 0 })
      setSelectedAspect(typeof aspect === 'number' ? aspect : undefined)
    }
  }, [open, aspect])


  const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const image = event.currentTarget
    imgRef.current = image

    const displayWidth = image.clientWidth || image.width
    const displayHeight = image.clientHeight || image.height

    imageMetricsRef.current = {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      displayWidth,
      displayHeight,
    }

    const initialCrop = createInitialCrop(displayWidth, displayHeight, typeof aspect === 'number' ? aspect : selectedAspect)
    setCrop(initialCrop)
    setCompletedCrop(cropToPixelCrop(initialCrop))
  }, [aspect, selectedAspect])

  const handleAspectChange = useCallback((value: number | 'free') => {
    const metric = imageMetricsRef.current
    const nextAspect = value === 'free' ? undefined : value
    setSelectedAspect(nextAspect)
    if (metric) {
      const nextCrop = createInitialCrop(metric.displayWidth, metric.displayHeight, nextAspect)
      setCrop(nextCrop)
      setCompletedCrop(cropToPixelCrop(nextCrop))
    }
  }, [])

  const handleCropChange = useCallback((nextCrop: Crop) => {
    setCrop(nextCrop)
    setCompletedCrop(cropToPixelCrop(nextCrop))
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || !originalFile || !completedCrop || !imgRef.current) {
      return
    }
    if (completedCrop.width < 1 || completedCrop.height < 1) {
      return
    }

    const image = imgRef.current
    const displayWidth = image.clientWidth || image.width
    const displayHeight = image.clientHeight || image.height

    if (!displayWidth || !displayHeight) {
      return
    }

    const scaleX = image.naturalWidth / displayWidth
    const scaleY = image.naturalHeight / displayHeight

    const area: CropAreaPixels = {
      x: Math.max(0, Math.round(completedCrop.x * scaleX)),
      y: Math.max(0, Math.round(completedCrop.y * scaleY)),
      width: Math.max(1, Math.round(completedCrop.width * scaleX)),
      height: Math.max(1, Math.round(completedCrop.height * scaleY)),
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
  }, [completedCrop, imageSrc, onComplete, originalFile])

  if (!open || !imageSrc || !originalFile) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500">Drag the corner handles to define your crop. Use the presets for quick ratios or stay in Free mode for full control.</p>
        </div>
        <div
          className="relative flex w-full items-center justify-center bg-black/80 px-4 py-6"
          style={{ height: `clamp(${CROP_CONTAINER_MIN_HEIGHT}px, 60vh, ${CROP_CONTAINER_MAX_HEIGHT}px)` }}
        >
          <div
            className="relative mx-auto w-full overflow-hidden"
            style={{ maxWidth: CROP_CONTAINER_MAX_WIDTH, height: '100%' }}
          >
            <ReactCrop
              crop={crop}
              onChange={handleCropChange}
              aspect={selectedAspect}
              minWidth={MIN_SELECTION_PX}
              minHeight={MIN_SELECTION_PX}
              keepSelection
              ruleOfThirds
              className="flex h-full w-full items-center justify-center"
              style={{ width: '100%', height: '100%' }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Image to crop"
                onLoad={handleImageLoad}
                className="h-full w-full max-h-full max-w-full select-none object-contain"
                style={{ touchAction: 'none' }}
              />
            </ReactCrop>
          </div>
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={processing || !completedCrop}>
              {processing ? 'Cropping...' : 'Apply crop'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
