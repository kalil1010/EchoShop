'use client'

import { useState, useEffect, useRef } from 'react'
import { generateBlurPlaceholder } from '@/lib/imageUtils'

interface ProgressiveImageProps {
  src: string
  alt: string
  className?: string
  blurDataURL?: string
  onLoad?: () => void
  loading?: 'lazy' | 'eager'
}

export function ProgressiveImage({
  src,
  alt,
  className = '',
  blurDataURL,
  onLoad,
  loading = 'lazy',
}: ProgressiveImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(blurDataURL || generateBlurPlaceholder())
  const [isLoaded, setIsLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!src) return

    const img = new Image()
    img.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
      onLoad?.()
    }
    img.src = src
  }, [src, onLoad])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        loading={loading}
        className={`transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-50 blur-sm'
        } ${className}`}
        style={{
          filter: isLoaded ? 'none' : 'blur(10px)',
        }}
      />
    </div>
  )
}

