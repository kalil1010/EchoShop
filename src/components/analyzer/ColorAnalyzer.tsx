'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Upload, Image as ImageIcon, Loader2, ShieldAlert, Sparkles, Copy } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import type { ColorAdvice, ColorPairing, ColorSwatch } from '@/lib/personalizedColors'
import { getColorName } from '@/lib/imageAnalysis'

type AnalysisSafety = {
  status: 'ok' | 'review' | 'blocked'
  reasons?: string[]
}

type AnalysisResult = {
  colors: ColorSwatch[]
  description?: string
  garmentType?: string
  safety?: AnalysisSafety
}

type AnalyzeImageResponse = {
  description?: string
  garmentType?: string
  colors?: Array<{ name?: string; hex?: string }>
  advice?: ColorAdvice | null
  safety?: AnalysisSafety
}

const formatReasons = (reasons?: string[]): string => {
  if (!reasons?.length) return ''
  if (reasons.length === 1) return reasons[0]
  return reasons.join(', ')
}

const normaliseName = (value?: string): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

const buildProfilePayload = (profile: ReturnType<typeof useAuth>['userProfile']) => {
  if (!profile) return undefined
  return {
    gender: profile.gender ?? undefined,
    age: profile.age ?? undefined,
    favoriteColors: profile.favoriteColors ?? [],
    dislikedColors: profile.dislikedColors ?? [],
    stylePreferences: profile.favoriteStyles ?? [],
  }
}

const SwatchBadge = ({ swatch }: { swatch: ColorSwatch }) => (
  <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 shadow-sm">
    <span
      className="h-4 w-4 rounded-full border border-black/10"
      style={{ backgroundColor: swatch.hex }}
      aria-hidden
    />
    <span className="text-xs font-medium text-gray-700">{normaliseName(swatch.name)}</span>
  </div>
)

export function ColorAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null)
  const cropFileRef = useRef<File | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [advice, setAdvice] = useState<ColorAdvice | null>(null)

  const { toast } = useToast()
  const { userProfile } = useAuth()

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
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }, [clearCropSource])

  const handleCropComplete = useCallback(
    (croppedFile: File, previewUrl: string) => {
      clearCropSource()
      setFile(croppedFile)
      setPreview(previewUrl)
      setAnalysis(null)
      setAdvice(null)
      setError(null)
      if (fileRef.current) {
        fileRef.current.value = ''
      }
    },
    [clearCropSource],
  )

  const onChooseFile = () => fileRef.current?.click()

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setError(null)
    clearCropSource()
    cropFileRef.current = selected
    setCropSource(URL.createObjectURL(selected))
    setIsCropOpen(true)
  }

  const toDataUrl = (input: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(input)
    })

  const analyze = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    try {
      const dataUrl = await toDataUrl(file)
      const payload = {
        dataUrl,
        profile: buildProfilePayload(userProfile),
      }
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = typeof body?.error === 'string' ? body.error : 'Analysis failed'
        throw new Error(message)
      }
      const body = (await res.json()) as AnalyzeImageResponse
      const rawColors = Array.isArray(body.colors) ? body.colors : []
      const colors: ColorSwatch[] = rawColors
        .map((entry) => {
          if (!entry || typeof entry.hex !== 'string') return null
          const name = typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name : getColorName(entry.hex)
          return { name, hex: entry.hex }
        })
        .filter((color): color is ColorSwatch => Boolean(color))
      setAnalysis({
        colors,
        description: typeof body.description === 'string' ? body.description : undefined,
        garmentType: typeof body.garmentType === 'string' ? body.garmentType : undefined,
        safety: body.safety,
      })
      setAdvice(body.advice ?? null)
    } catch (analysisError) {
      const message = analysisError instanceof Error ? analysisError.message : 'We could not analyze that image. Please try another photo.'
      setError(message)
      setAnalysis(null)
      setAdvice(null)
    } finally {
      setIsLoading(false)
    }
  }

  const copySummary = async () => {
    if (!advice?.summary) return
    try {
      await navigator.clipboard.writeText(advice.summary)
      toast({ variant: 'success', title: 'Summary copied' })
    } catch {
      toast({ variant: 'error', title: 'Could not copy summary' })
    }
  }

  const pairingSections = advice?.pairings ?? []
  const garmentLabel = useMemo(() => {
    if (!analysis?.garmentType) return 'this piece'
    const cleaned = analysis.garmentType.toLowerCase()
    if (cleaned === 'dress') return 'this dress'
    if (cleaned === 'top' || cleaned === 'bottom' || cleaned === 'outer layer' || cleaned === 'footwear' || cleaned === 'accessory') {
      return `this ${cleaned}`
    }
    return `this ${analysis.garmentType}`
  }, [analysis?.garmentType])

  return (
    <>
      <ImageCropDialog
        open={isCropOpen && !!cropSource && !!cropFileRef.current}
        imageSrc={cropSource}
        originalFile={cropFileRef.current}
        title="Crop clothing image"
        onCancel={handleCropCancel}
        onComplete={handleCropComplete}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Color Analyzer
          </CardTitle>
          <CardDescription>
            Upload a garment photo to get Mistral-powered color reads and personalised outfit pairings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
            {preview ? (
              <div className="space-y-4">
                <img src={preview} alt="Garment preview" className="mx-auto max-h-64 max-w-full rounded" />
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button variant="outline" onClick={onChooseFile} disabled={isLoading}>
                    Change Image
                  </Button>
                  <Button onClick={analyze} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing…
                      </>
                    ) : (
                      'Analyze Colors'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="space-y-2">
                  <Button onClick={onChooseFile}>Choose File</Button>
                  <p className="text-sm text-gray-500">PNG or JPG up to 10MB. Crop around the garment for best results.</p>
                </div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {analysis && (
            <div className="space-y-5">
              {analysis.safety && analysis.safety.status !== 'ok' && (
                <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  <ShieldAlert className="mt-1 h-4 w-4 flex-none" />
                  <div>
                    <div className="font-medium">
                      {analysis.safety.status === 'blocked'
                        ? 'This item may need manual review.'
                        : 'Heads up: double-check this item.'}
                    </div>
                    {analysis.safety.reasons && (
                      <div className="text-xs text-amber-700/80">{formatReasons(analysis.safety.reasons)}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border">
                <div className="border-b px-4 py-3">
                  <h3 className="text-base font-semibold text-gray-900">Color Highlights</h3>
                  {analysis.description && (
                    <p className="mt-1 text-sm text-gray-600">{analysis.description}</p>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  {analysis.colors.length > 0 ? (
                    <div className="space-y-2">
                      <p className="flex items-center text-sm font-medium text-gray-700">
                        <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
                        Dominant shades detected
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {analysis.colors.map((swatch) => (
                          <SwatchBadge key={`${swatch.hex}-${swatch.name}`} swatch={swatch} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No clear colors were detected—try a closer crop.</p>
                  )}

                  {advice?.summary && (
                    <div className="space-y-2 rounded-md border border-purple-100 bg-purple-50/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-purple-900">Stylist summary</p>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={copySummary}>
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-purple-900/90 leading-relaxed">{advice.summary}</p>
                    </div>
                  )}
                </div>
              </div>

              {pairingSections.length > 0 && (
                <div className="rounded-lg border">
                  <div className="border-b px-4 py-3">
                    <h3 className="text-base font-semibold text-gray-900">Personalised Pairings</h3>
                    <p className="text-sm text-gray-600">
                      Try these palettes with {garmentLabel}. We weigh your favourites and avoid your dislikes automatically.
                    </p>
                  </div>
                  <div className="space-y-4 p-4">
                    {pairingSections.map((pairing: ColorPairing) => (
                      <div key={pairing.title} className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-gray-800">{pairing.title}</span>
                          {pairing.highlight && (
                            <span className="text-xs text-purple-600">
                              Highlights your love of {pairing.highlight}.
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {pairing.colors.map((swatch) => (
                            <SwatchBadge key={`${pairing.title}-${swatch.hex}`} swatch={swatch} />
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-gray-600 leading-relaxed">{pairing.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default ColorAnalyzer

