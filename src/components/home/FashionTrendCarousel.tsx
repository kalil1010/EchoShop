"use client"

import Image from "next/image"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Maximize2, ShoppingBag, Store } from "lucide-react"

import { BRAND_PIECES } from "@/data/brandPieces"
import type { FashionPiece, GenderTarget } from "@/types/arrivals"
import { cn } from "@/lib/utils"

interface FashionCarouselProps {
  gender?: GenderTarget | "other" | null
  age?: number | null
}

const AUTO_ROTATE_MS = 7000
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80"
const GENDER_OPTIONS = ["male", "female", "unisex"] as const

const normalizeGender = (gender?: FashionCarouselProps["gender"]): GenderTarget => {
  if (gender === "male" || gender === "female" || gender === "unisex") return gender
  return "unisex"
}

type ApiPiece = FashionPiece

export function FashionTrendCarousel({ gender }: FashionCarouselProps) {
  const effectiveGender = normalizeGender(gender ?? undefined)
  const [genderMode, setGenderMode] = useState<GenderTarget>(effectiveGender)
  const appliedGender: GenderTarget = genderMode

  const [remotePieces, setRemotePieces] = useState<ApiPiece[] | null>(null)

  useEffect(() => {
    setGenderMode(effectiveGender)
  }, [effectiveGender])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/local-arrivals", { cache: "no-store" })
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled && Array.isArray(data.arrivals)) {
          setRemotePieces(data.arrivals as ApiPiece[])
        }
      } catch {
        if (!cancelled) setRemotePieces(null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const basePieces = remotePieces && remotePieces.length > 0 ? remotePieces : BRAND_PIECES

  const pieces = useMemo(() => {
    const matches = basePieces.filter(
      (piece) =>
        appliedGender === "unisex" ||
        piece.gender === "unisex" ||
        piece.gender === appliedGender,
    )

    if (matches.length > 0) {
      return matches.slice(0, 18)
    }

    return basePieces.filter((piece) => piece.gender === "unisex").slice(0, 18)
  }, [basePieces, appliedGender])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [pieces, appliedGender])

  useEffect(() => {
    if (pieces.length <= 1) return
    const handle = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % pieces.length)
    }, AUTO_ROTATE_MS)
    return () => window.clearInterval(handle)
  }, [pieces.length])

  const showPrev = useCallback(() => {
    setIndex((prev) => (prev - 1 + pieces.length) % pieces.length)
  }, [pieces.length])

  const showNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % pieces.length)
  }, [pieces.length])

  const [isLightboxOpen, setLightboxOpen] = useState(false)
  const [imgSrc, setImgSrc] = useState(FALLBACK_IMAGE)

  const active = pieces[index] ?? null

  const handleOpenFullImage = useCallback(() => setLightboxOpen(true), [])

  const handleKeyOpen = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setLightboxOpen(true)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      setImgSrc(FALLBACK_IMAGE)
      return
    }
    setImgSrc(active.imageUrl || FALLBACK_IMAGE)
  }, [active])

  if (!active) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-sm text-gray-500 shadow-lg">
        We’re curating outfits for you—check back shortly for fresh picks from Egyptian boutiques.
      </div>
    )
  }

  const storeBadge = active.store.includes(' - ') ? active.store.split(' - ')[0].trim() : active.store
  const featureBadges = [
    storeBadge,
    active.priceLabel,
    ...active.categories.slice(0, 1),
  ].filter(Boolean)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-5">
        <div
          className="relative aspect-[4/3] overflow-hidden sm:h-auto md:col-span-3 md:h-[420px]"
          tabIndex={0}
          role="button"
          onClick={handleOpenFullImage}
          onKeyDown={handleKeyOpen}
        >
          <Image
            src={imgSrc}
            alt={active.title}
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="object-cover"
            priority
            unoptimized
            onError={() => setImgSrc(FALLBACK_IMAGE)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent" />
          <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/85">
            {featureBadges.map((badge) => (
              <span key={badge} className="rounded-full bg-white/15 px-3 py-1">
                {badge}
              </span>
            ))}
            {active.price && (
              <span className="rounded-full bg-white/15 px-3 py-1">{active.price}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col justify-between md:col-span-2">
          <div className="space-y-4 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
              Handpicked | {active.brand}
            </p>
            <h3 className="text-2xl font-bold text-gray-900">{active.title}</h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Browse:</span>
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGenderMode(opt)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold border transition",
                    genderMode === opt
                      ? "border-purple-500 text-purple-600 bg-purple-50"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50",
                  )}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{active.description}</p>
            {active.highlights && active.highlights.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {active.highlights.slice(0, 3).map((highlight) => (
                  <span key={highlight} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
                    {highlight}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <Store className="h-3.5 w-3.5" />
              <span>{active.store}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 p-6 sm:flex-nowrap">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={showPrev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-purple-400 hover:text-purple-500"
                aria-label="Show previous piece"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={showNext}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition hover:border-purple-400 hover:text-purple-500"
                aria-label="Show next piece"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {pieces.map((piece, pieceIndex) => (
                <span
                  key={piece.id}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition",
                    pieceIndex === index ? "bg-purple-500" : "bg-gray-300",
                  )}
                  aria-hidden
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleOpenFullImage} className="hidden sm:inline-flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                View Full Image
              </Button>
              <a
                href={active.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-purple-400 hover:text-purple-600"
              >
                <ShoppingBag className="h-4 w-4" />
                Shop This Piece
              </a>
            </div>
          </div>
        </div>
      </div>

      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <div className="relative max-h-[90vh] w-full max-w-4xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow"
              onClick={() => setLightboxOpen(false)}
              aria-label="Close image"
            >
              Close
            </button>
            <Image src={imgSrc} alt={active.title} width={1600} height={900} className="h-auto w-full rounded-lg object-contain" unoptimized />
          </div>
        </div>
      )}
    </div>
  )
}
