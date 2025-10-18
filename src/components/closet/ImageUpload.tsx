'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Upload, Image as ImageIcon, Loader2, ShieldAlert, AlertTriangle, Trash2, Sparkles } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import type { ClothingItem } from '@/types/clothing'
import { getColorName } from '@/lib/imageAnalysis'
import { sanitizeText, isPermissionError } from '@/lib/security'
import { fireConfetti } from '@/lib/confetti'

interface ImageUploadProps {
  onItemAdded?: (item: ClothingItem) => void
}

type ModerationSnapshot = {
  status: 'ok' | 'review' | 'blocked' | 'error'
  message?: string | null
  category?: string | null
  reasons?: string[] | null
}

type MatchingSuggestions = {
  complementary: string
  analogous: string[]
  triadic: string[]
}

type ProcessedPiece = {
  tempId: string
  outfitGroupId: string
  garmentType: ClothingItem['garmentType']
  detectionLabel: string
  detectionConfidence: number
  provider: string
  boundingBox: { left: number; top: number; width: number; height: number }
  dominantColors: string[]
  primaryHex: string | null
  colorNames: string[]
  colorPercentages: Record<string, number>
  aiPrompt: string | null
  moderation: ModerationSnapshot
  previewDataUrl: string
  matchingSuggestions?: MatchingSuggestions | null
  richPalette?: unknown
  mistralColors?: Array<{ name: string; hex: string }>
  accepted: boolean
  description?: string
  overridePrimary?: string | null
  overrideColors?: string[] | null
  draftHex?: string
}

type ProcessResponsePiece = {
  tempId: string
  outfitGroupId: string
  garmentType?: ClothingItem['garmentType']
  detectionLabel?: string
  detectionConfidence?: number
  provider?: string
  boundingBox: { left: number; top: number; width: number; height: number }
  dominantColors?: string[]
  primaryHex?: string | null
  colorNames?: string[]
  colorPercentages?: Record<string, number>
  aiPrompt?: string | null
  moderation?: ModerationSnapshot
  previewDataUrl: string
  matchingSuggestions?: MatchingSuggestions | null
  richPalette?: unknown
  mistralColors?: Array<{ name: string; hex: string }>
}

const GARMENT_TYPES: ClothingItem['garmentType'][] = ['top', 'bottom', 'outerwear', 'footwear', 'accessory']

const ensureHex = (hex: string): string => {
  const trimmed = hex.trim()
  if (!trimmed) return '#000000'
  return trimmed.startsWith('#') ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`
}

const isValidHex = (hex: string): boolean => /^#?[0-9a-fA-F]{6}$/.test(hex.trim())

export function ImageUpload({ onItemAdded }: ImageUploadProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [processing, setProcessing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [pieces, setPieces] = useState<ProcessedPiece[]>([])
  const [outfitGroupId, setOutfitGroupId] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [sourceFileName, setSourceFileName] = useState<string | null>(null)
  const sourcePreviewUrlRef = useRef<string | null>(null)

  const clearSourcePreview = useCallback(() => {
    if (sourcePreviewUrlRef.current) {
      URL.revokeObjectURL(sourcePreviewUrlRef.current)
      sourcePreviewUrlRef.current = null
    }
    setSourcePreview(null)
  }, [])

  const resetState = useCallback(() => {
    setPieces([])
    setOutfitGroupId(null)
    setWarnings([])
    setSourceFileName(null)
    clearSourcePreview()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [clearSourcePreview])

  const updatePiece = useCallback((tempId: string, updater: (current: ProcessedPiece) => ProcessedPiece) => {
    setPieces((prev) => prev.map((piece) => (piece.tempId === tempId ? updater(piece) : piece)))
  }, [])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!user) {
      toast({
        variant: 'error',
        title: 'Sign in required',
        description: 'Please sign in to analyze and upload clothing items.',
      })
      event.target.value = ''
      return
    }

    if (file.size > 12 * 1024 * 1024) {
      toast({
        variant: 'error',
        title: 'Image too large',
        description: 'Please choose an image smaller than 12MB.',
      })
      event.target.value = ''
      return
    }

    try {
      setProcessing(true)
      setPieces([])
      setWarnings([])
      setOutfitGroupId(null)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/closet/process', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.error || 'Image analysis failed. Please try again.')
      }

      const body = await response.json()
      const responsePieces = Array.isArray(body.pieces) ? (body.pieces as ProcessResponsePiece[]) : []
      const mappedPieces: ProcessedPiece[] = responsePieces.map((piece) => ({
        tempId: piece.tempId,
        outfitGroupId: piece.outfitGroupId,
        garmentType: (piece.garmentType || 'top') as ClothingItem['garmentType'],
        detectionLabel: piece.detectionLabel || 'Garment',
        detectionConfidence: typeof piece.detectionConfidence === 'number' ? piece.detectionConfidence : 0,
        provider: piece.provider || 'vision',
        boundingBox: piece.boundingBox,
        dominantColors: Array.isArray(piece.dominantColors) ? piece.dominantColors : [],
        primaryHex: piece.primaryHex ?? null,
        colorNames: Array.isArray(piece.colorNames) ? piece.colorNames : [],
        colorPercentages: piece.colorPercentages ?? {},
        aiPrompt: piece.aiPrompt ?? null,
        moderation: piece.moderation ?? { status: 'ok' },
        previewDataUrl: piece.previewDataUrl,
        matchingSuggestions: piece.matchingSuggestions ?? null,
        richPalette: piece.richPalette ?? null,
        mistralColors: Array.isArray(piece.mistralColors) ? piece.mistralColors : [],
        accepted: true,
        description: '',
        overridePrimary: null,
        overrideColors: null,
        draftHex: '',
      }))

      if (!mappedPieces.length) {
        throw new Error('No garments detected. Try using a clearer image or adjust the framing.')
      }

      setPieces(mappedPieces)
      setOutfitGroupId(body.outfitGroupId ?? null)
      setWarnings(Array.isArray(body.warnings) ? body.warnings : [])
      setSourceFileName(file.name)
      clearSourcePreview()
      const previewUrl = URL.createObjectURL(file)
      sourcePreviewUrlRef.current = previewUrl
      setSourcePreview(previewUrl)

      toast({
        variant: 'success',
        title: 'Analysis complete',
        description: `Detected ${mappedPieces.length} item${mappedPieces.length > 1 ? 's' : ''}. Review and confirm below.`,
      })
    } catch (error) {
      console.error('[closet] process failed', error)
      toast({
        variant: 'error',
        title: 'Unable to analyze image',
        description: error instanceof Error ? error.message : 'Vision pipeline failed. Please try again.',
      })
    } finally {
      setProcessing(false)
    }
  }, [clearSourcePreview, toast, user])

  const handleCommit = useCallback(async () => {
    if (!user) {
      toast({
        variant: 'error',
        title: 'Sign in required',
        description: 'Please sign in to add items to your closet.',
      })
      return
    }

    const acceptedPieces = pieces.filter((piece) => piece.accepted)
    if (!acceptedPieces.length) {
      toast({
        variant: 'error',
        title: 'No items selected',
        description: 'Select at least one garment to add to your closet.',
      })
      return
    }

    if (!outfitGroupId) {
      toast({
        variant: 'error',
        title: 'Missing outfit group',
        description: 'Please re-run the detection before saving.',
      })
      return
    }

    setCommitting(true)
    try {
      const payload = {
        outfitGroupId,
        originalFileName: sourceFileName ?? undefined,
        pieces: pieces.map((piece) => {
          const dominant = piece.overrideColors ?? piece.dominantColors
          const primary = piece.overridePrimary ?? piece.primaryHex
          return {
            tempId: piece.tempId,
            garmentType: piece.garmentType,
            accepted: piece.accepted,
            dominantColors: dominant,
            primaryHex: primary,
            colorNames: dominant.map((hex: string) => getColorName(hex)),
            aiPrompt: piece.aiPrompt,
            detectionLabel: piece.detectionLabel,
            detectionConfidence: piece.detectionConfidence,
            detectionProvider: piece.provider,
            moderation: piece.moderation,
            previewDataUrl: piece.previewDataUrl,
            description: piece.description ? sanitizeText(piece.description, { maxLength: 240 }) : null,
            outfitGroupId: piece.outfitGroupId,
          }
        }),
      }

      const response = await fetch('/api/closet/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.error || 'Failed to save items to Supabase.')
      }

      const data = await response.json()
      const items: ClothingItem[] = Array.isArray(data.items) ? data.items : []
      items.forEach((item) => onItemAdded?.(item))

      toast({
        variant: 'success',
        title: 'Closet updated',
        description: `Added ${items.length} item${items.length === 1 ? '' : 's'} to your closet.`,
      })
      void fireConfetti({ particleCount: 160, origin: { y: 0.8 } })
      resetState()
    } catch (error) {
      console.error('[closet] commit failed', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Session expired' : 'Action not allowed',
          description: error.message,
        })
      } else {
        toast({
          variant: 'error',
          title: 'Unable to save items',
          description: error instanceof Error ? error.message : 'Upload failed. Please try again.',
        })
      }
    } finally {
      setCommitting(false)
    }
  }, [onItemAdded, outfitGroupId, pieces, resetState, sourceFileName, toast, user])

  const handleHexAdd = useCallback((pieceId: string) => {
    const target = pieces.find((piece) => piece.tempId === pieceId)
    if (!target) return
    const draft = target.draftHex ?? ''
    if (!draft) return
    if (!isValidHex(draft)) {
      toast({
        variant: 'error',
        title: 'Invalid color',
        description: 'Enter a 6-digit hex code (e.g. #0099FF).',
      })
      return
    }
    const normalized = ensureHex(draft)
    updatePiece(pieceId, (current) => {
      const colors = current.overrideColors ?? current.dominantColors
      if (colors.includes(normalized)) {
        return {
          ...current,
          overridePrimary: normalized,
          draftHex: '',
        }
      }
      return {
        ...current,
        overrideColors: [...colors, normalized],
        overridePrimary: normalized,
        draftHex: '',
      }
    })
  }, [pieces, toast, updatePiece])

  const hasAcceptedPieces = useMemo(() => pieces.some((piece) => piece.accepted), [pieces])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5" />
          Add Closet Items
        </CardTitle>
        <CardDescription>
          Upload a photo and we&apos;ll detect each garment, crop it automatically, and extract accurate base colors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {sourcePreview ? (
            <div className="space-y-4">
              <img src={sourcePreview} alt="Original upload preview" className="max-w-full max-h-60 mx-auto rounded-lg" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={processing || committing}>
                  Re-run detection
                </Button>
                <Button variant="ghost" onClick={resetState} disabled={processing || committing}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <Button onClick={() => fileInputRef.current?.click()} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Select Image'
                  )}
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  JPG or PNG up to 12MB. Include entire outfit photos—we&apos;ll segment each piece.
                </p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="flex items-start text-sm text-amber-800">
                <AlertTriangle className="mr-2 h-4 w-4 mt-0.5" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {pieces.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                Review Detected Items
              </h3>
              <span className="text-sm text-gray-500">
                {pieces.filter((piece) => piece.accepted).length} selected of {pieces.length}
              </span>
            </div>
            <div className="space-y-5">
              {pieces.map((piece) => {
                const colors = piece.overrideColors ?? piece.dominantColors
                const primaryHex = ensureHex(piece.overridePrimary ?? piece.primaryHex ?? colors[0] ?? '#000000')
                return (
                  <div key={piece.tempId} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col md:flex-row gap-4 p-4">
                      <div className="md:w-48 shrink-0">
                        <img src={piece.previewDataUrl} alt={piece.detectionLabel} className="w-full h-auto rounded-md border border-gray-200" />
                        <label className="mt-3 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={piece.accepted}
                            onChange={(event) => updatePiece(piece.tempId, (current) => ({
                              ...current,
                              accepted: event.target.checked,
                            }))}
                          />
                          Keep this item
                        </label>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm uppercase tracking-wide text-gray-600">
                            {piece.detectionLabel}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(piece.detectionConfidence * 100).toFixed(0)}% confidence · {piece.provider}
                          </span>
                          {piece.moderation.status !== 'ok' && (
                            <span className="inline-flex items-center rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                              <ShieldAlert className="mr-1 h-3 w-3" />
                              Needs review
                            </span>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Garment Type</label>
                            <select
                              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none"
                              value={piece.garmentType}
                              onChange={(event) => updatePiece(piece.tempId, (current) => ({
                                ...current,
                                garmentType: event.target.value as ClothingItem['garmentType'],
                              }))}
                            >
                              {GARMENT_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Primary Color</label>
                            <div className="flex flex-wrap gap-2">
                              {colors.map((hex) => {
                                const normalized = ensureHex(hex)
                                const isActive = normalized.toLowerCase() === primaryHex.toLowerCase()
                                return (
                                  <button
                                    key={normalized}
                                    type="button"
                                    className={`h-9 w-9 rounded-full border-2 transition focus:outline-none ${isActive ? 'border-black ring-2 ring-offset-1' : 'border-gray-200'}`}
                                    style={{ backgroundColor: normalized }}
                                    onClick={() => updatePiece(piece.tempId, (current) => ({
                                      ...current,
                                      overridePrimary: normalized,
                                    }))}
                                    title={getColorName(normalized)}
                                  />
                                )
                              })}
                            </div>
                            {piece.mistralColors && piece.mistralColors.length > 0 && (
                              <div className="text-xs text-gray-500">
                                AI colors: {piece.mistralColors.map((color) => `${color.name} (${color.hex})`).join(', ')}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Input
                                value={piece.draftHex ?? ''}
                                onChange={(event) => updatePiece(piece.tempId, (current) => ({
                                  ...current,
                                  draftHex: event.target.value,
                                }))}
                                placeholder="#FFFFFF"
                                className="h-9"
                              />
                              <Button type="button" variant="outline" onClick={() => handleHexAdd(piece.tempId)}>
                                Add color
                              </Button>
                            </div>
                          </div>
                        </div>

                        {piece.moderation.status !== 'ok' && (
                          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {piece.moderation.message ?? 'Content moderation flagged this image for manual review.'}
                            {piece.moderation.category && (
                              <div className="mt-1 text-xs text-red-600">
                                Category: {piece.moderation.category}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Description (optional)</label>
                          <Input
                            value={piece.description ?? ''}
                            placeholder="e.g., Oversized cream sweatshirt with red graphic"
                            onChange={(event) => updatePiece(piece.tempId, (current) => ({
                              ...current,
                              description: sanitizeText(event.target.value, { maxLength: 220 }),
                            }))}
                          />
                        </div>

                        {piece.aiPrompt && (
                          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            <span className="font-medium text-gray-600 block mb-1">AI Summary</span>
                            {piece.aiPrompt}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                Items saved together share outfit group ID{' '}
                <span className="font-medium text-gray-700">{outfitGroupId}</span>.
              </div>
              <Button
                onClick={handleCommit}
                disabled={!hasAcceptedPieces || committing}
                className="min-w-[180px]"
              >
                {committing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  `Save ${pieces.filter((piece) => piece.accepted).length} Item${pieces.filter((piece) => piece.accepted).length === 1 ? '' : 's'}`
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ImageUpload
