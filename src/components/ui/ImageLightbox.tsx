'use client'

import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ImageLightboxProps {
  open: boolean
  imageUrl?: string | null
  onClose: () => void
  caption?: string
}

export function ImageLightbox({ open, imageUrl, onClose, caption }: ImageLightboxProps) {
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  if (!open || !imageUrl) return null

  const content = (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="relative max-h-full max-w-5xl overflow-hidden rounded-2xl bg-black/40 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-[1] rounded-full bg-black/70 p-2 text-white shadow-lg transition hover:bg-black/90"
          aria-label="Close image preview"
        >
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={caption || 'Preview'} className="max-h-[85vh] max-w-full object-contain" />
        {caption && (
          <div className="bg-black/70 px-4 py-2 text-sm text-white">
            {caption}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

