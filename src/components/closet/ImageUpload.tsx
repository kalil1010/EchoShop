'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
import { getMatchingColors, analyzeImageColors } from '@/lib/imageAnalysis'
import { useToast } from '@/components/ui/toast'
import { ClothingItem } from '@/types/clothing'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { isPermissionError, mapSupabaseError, sanitizeText } from '@/lib/security'
import { type ClothingRow, mapClothingRow, uploadClothingImage } from '@/lib/closet'
import { ImageCropDialog } from '@/components/ui/ImageCropDialog'
import { savePaletteForUser } from '@/lib/palette'
import { fireConfetti } from '@/lib/confetti'

interface ImageUploadProps {
  onItemAdded?: (item: ClothingItem) => void
}

export function ImageUpload({ onItemAdded }: ImageUploadProps) {
  const { user } = useAuth()
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (error) {
      console.error('Supabase client initialisation failed:', error)
      return null
    }
  }, [])

  const moderateImage = useCallback(async (file: File) => {
    const payload = new FormData()
    payload.append('file', file)

    try {
      const response = await fetch('/api/moderate-image', {
        method: 'POST',
        body: payload,
      })

      let body: any = null
      try {
        body = await response.json()
      } catch (err) {
        console.warn('Moderation response parse failed:', err)
      }

      if (!response.ok || !body?.ok) {
        const message = body?.error || 'Image blocked by our system. Please select a different one.'
        const category = typeof body?.category === 'string' ? body.category : null
        const reasons = Array.isArray(body?.reasons) ? body.reasons : []
        if (reasons.length) {
          console.warn('[moderation] blocked', reasons)
        }
        return { ok: false, message, category }
      }

      return { ok: true }
    } catch (error) {
      console.error('[moderation] request failed', error)
      return { ok: false, message: 'Unable to verify the image. Please try again.', category: null }
    }
  }, [])

const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const [garmentType, setGarmentType] = useState<string>('top')
  const [description, setDescription] = useState('')
  const [selectedBaseColor, setSelectedBaseColor] = useState<string | null>(null)
  const [aiMatches, setAiMatches] = useState<{ complementary: string; analogous: string[]; triadic: string[] } | null>(null)
  const [aiRichMatches, setAiRichMatches] = useState<any | null>(null)
  const [plan, setPlan] = useState<{ top?: string; bottom?: string; outerwear?: string; footwear?: string; accessory?: string }>({})
  const updatePlan = (k: keyof typeof plan, v: string) => setPlan((p) => ({ ...p, [k]: v }))
  const [activeSlot, setActiveSlot] = useState<'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'>('top')
  const assign = (hex: string) => updatePlan(activeSlot, hex)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [customHex, setCustomHex] = useState<string>('#000000')
  const [moderationMessage, setModerationMessage] = useState<string | null>(null)
  const [moderationCategory, setModerationCategory] = useState<string | null>(null)
  // Awesomeness meter helpers
  const toHsl = (hex?: string) => {
    if (!hex) return null
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!m) return null
    let r = parseInt(m[1], 16) / 255
    let g = parseInt(m[2], 16) / 255
    let b = parseInt(m[3], 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h *= 60
    }
    return { h, s, l }
  }
  const hueDist = (a: number, b: number) => {
    const d = Math.abs(a - b)
    return Math.min(d, 360 - d)
  }
  const scorePlan = () => {
    const base = analysis?.dominantColors?.[0] || aiRichMatches?.base
    const baseH = toHsl(base)
    const chosen = Object.values(plan).filter(Boolean) as string[]
    if (!baseH || chosen.length === 0) return { score: 0, label: 'Start choosing', color: '#9ca3af' }
    let sum = 0
    chosen.forEach((hex) => {
      const c = toHsl(hex)!
      const d = hueDist(baseH.h, c.h)
      let s = 0
      if (d <= 12) s = 15
      else if (d >= 15 && d <= 35) s = 20
      else if (d >= 165 && d <= 195) s = 25
      else if ((d >= 110 && d <= 130) || (d >= 230 && d <= 250)) s = 20
      else if ((d >= 80 && d <= 100) || (d >= 260 && d <= 280)) s = 15
      else s = 10
      const dl = Math.abs(baseH.l - c.l)
      if (dl >= 0.25 && dl <= 0.6) s += 5
      else if (dl < 0.1) s -= 3
      s = Math.max(0, Math.min(30, s))
      sum += s
    })
    const score = Math.round((sum / (chosen.length * 30)) * 100)
    let label = 'Okay'
    let color = '#f59e0b'
    if (score < 40) { label = 'Needs work'; color = '#ef4444' }
    else if (score < 70) { label = 'Good'; color = '#f59e0b' }
    else if (score < 85) { label = 'Great'; color = '#10b981' }
    else { label = 'Awesome'; color = '#16a34a' }
    return { score, label, color }
  }
  const [aiPrimaryHex, setAiPrimaryHex] = useState<string | null>(null)
  const [aiColorNames, setAiColorNames] = useState<string[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
const cropFileRef = useRef<File | null>(null)
  const [cropSource, setCropSource] = useState<string | null>(null)
  const [isCropOpen, setIsCropOpen] = useState(false)
  const updatePreview = useCallback((next: string | null) => {
    setPreview((current) => {
      if (current && current !== next) {
        URL.revokeObjectURL(current)
      }
      return next
    })
  }, [])
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
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [clearCropSource])
  const handleChooseAnother = useCallback(() => {
    setModerationMessage(null)
    setModerationCategory(null)
    setSelectedFile(null)
    updatePreview(null)
    setAnalysis(null)
    setAiMatches(null)
    setAiRichMatches(null)
    setAiPrimaryHex(null)
    setAiColorNames(null)
    setSelectedBaseColor(null)
    setCustomColors([])
    setPlan({})
    clearCropSource()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }, [clearCropSource, updatePreview])

  const handleDismissModeration = useCallback(() => {
    setModerationMessage(null)
    setModerationCategory(null)
  }, [])

const { toast } = useToast()

  const analyzeSelectedImage = useCallback(async (file: File) => {
    setModerationMessage(null)
    setModerationCategory(null)
    setSelectedFile(file)
    setPlan({})
    setCustomColors([])
    setAiMatches(null)
    setAiRichMatches(null)
    setAiPrimaryHex(null)
    setAiColorNames(null)
    setSelectedBaseColor(null)
    setAnalyzing(true)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image'))
        reader.readAsDataURL(file)
      })

      const rough = await analyzeImageColors(file, 'enhanced')
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, dominantHexes: rough.dominantColors }),
      })
      if (!res.ok) throw new Error('AI analyze failed')
      const ai = await res.json()
      const dom: string[] = Array.isArray(ai.dominantHexes) ? ai.dominantHexes : []
      setAnalysis({ dominantColors: dom, colorPercentages: {} })
      setSelectedBaseColor(dom[0] || null)
      if (ai.garmentType) setGarmentType(ai.garmentType)
      if (ai.matches) setAiMatches(ai.matches)
      if (ai.richMatches) setAiRichMatches(ai.richMatches)
      if (ai.primaryHex) setAiPrimaryHex(ai.primaryHex)
      if (Array.isArray(ai.colorNames)) setAiColorNames(ai.colorNames)
    } catch (error) {
      console.error('Analysis failed:', error)
      toast({ variant: 'error', title: 'AI analysis failed', description: 'Please try another image.' })
    } finally {
      setAnalyzing(false)
    }
  }, [toast])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'error',
        title: 'Image too large',
        description: 'Please choose an image smaller than 10MB.',
      })
      event.target.value = ''
      return
    }
    clearCropSource()
    cropFileRef.current = file
    setCropSource(URL.createObjectURL(file))
    setIsCropOpen(true)
  }, [clearCropSource, toast])

  const handleCropComplete = useCallback((croppedFile: File, previewUrl: string) => {
    clearCropSource()
    updatePreview(previewUrl)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    void analyzeSelectedImage(croppedFile)
  }, [analyzeSelectedImage, clearCropSource, updatePreview])

  const handleUpload = async () => {
    if (!analysis || !selectedFile) {
      toast({ variant: 'error', title: 'Upload incomplete', description: 'Select an image and run analysis before uploading.' })
      return
    }
    if (!user) {
      toast({ variant: 'error', title: 'Sign in required', description: 'Please sign in to add items to your closet.' })
      return
    }
    if (!supabase) {
      toast({ variant: 'error', title: 'Supabase not configured', description: 'Please add Supabase environment variables.' })
      return
    }

    setModerationMessage(null)
    setModerationCategory(null)
    setUploading(true)
    try {
      const moderation = await moderateImage(selectedFile)
      if (!moderation.ok) {
        const message = moderation.message || 'Image blocked by our system. Please select a different one.'
        const note = message.includes('contact support') ? '' : ' If you believe this was a mistake, please contact support.'
        setModerationMessage(`${message}${note}`)
        setModerationCategory(moderation.category ?? null)
        setUploading(false)
        return
      }

      const { storagePath, publicUrl } = await uploadClothingImage(user.uid, selectedFile)
      const nowIso = new Date().toISOString()
      const resolvedGarmentType = (garmentType || 'top') as ClothingItem['garmentType']
      const safeDescription = description ? sanitizeText(description, { maxLength: 240 }) : ''

      const insertPayload = {
        user_id: user.uid,
        image_url: publicUrl,
        storage_path: storagePath,
        garment_type: resolvedGarmentType,
        clothing_type: resolvedGarmentType,
        dominant_colors: analysis.dominantColors,
        primary_hex: aiPrimaryHex,
        color_names: aiColorNames,
        ai_matches: aiRichMatches,
        description: safeDescription || null,
        season: 'all',
        created_at: nowIso,
        updated_at: nowIso,
      }

      const { data, error } = await supabase
        .from('clothing')
        .insert(insertPayload)
        .select('*')
        .maybeSingle()

      if (error) throw mapSupabaseError(error)
      if (!data) throw new Error('No data returned from Supabase')

      const newItem = mapClothingRow(data as ClothingRow)

      onItemAdded?.(newItem)
      toast({ variant: 'success', title: 'Item added to closet' })
      void fireConfetti({ particleCount: 140, origin: { y: 0.85 } })

      setSelectedFile(null)
      updatePreview(null)
      setAnalysis(null)
      setDescription('')
      setPlan({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Upload failed:', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Session expired' : 'Action not allowed',
          description: error.reason === 'auth'
            ? 'Please sign in again and retry.'
            : 'You can only manage your own closet items.',
        })
      } else {
        toast({
          variant: 'error',
          title: 'Failed to upload item',
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      }
    } finally {
      setUploading(false)
    }
  }

  // no re-analysis toggle; always use enhanced

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
          Add Clothing Item
        </CardTitle>
        <CardDescription>
          Upload a photo of your clothing item for automatic color and type analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {moderationMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-red-700">{moderationMessage}</div>
            {moderationCategory && (
              <div className="mt-2 text-xs text-red-600/80">Detected category: {moderationCategory}.</div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={handleChooseAnother} disabled={uploading}>
                Choose another image
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissModeration}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-48 mx-auto rounded-lg"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Change Image
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Select Image
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  PNG, JPG up to 10MB
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

        {analyzing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Analyzing image...</span>
          </div>
        )}

        {analysis && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="garmentType" className="text-sm font-medium">
                  Garment Type
                </label>
                <select
                  id="garmentType"
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  className="w-full h-10 px-3 py-2 text-sm border border-input rounded-md bg-background"
                >
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="footwear">Footwear</option>
                  <option value="accessory">Accessory</option>
                  <option value="outerwear">Outerwear</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dominant Colors (AI)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {analysis.dominantColors.map((color: string, index: number) => {
                    const isActive = (selectedBaseColor || analysis.dominantColors[0]) === color
                    const isPrimary = aiPrimaryHex ? aiPrimaryHex.toLowerCase() === color.toLowerCase() : index === 0
                    return (
                      <button
                        type="button"
                        key={index}
                        onClick={() => setSelectedBaseColor(color)}
                        className={`group relative rounded-md overflow-hidden border shadow-sm ${isActive ? 'ring-2 ring-purple-500 border-purple-400' : ''}`}
                        title={`Use ${color.toUpperCase()} as base`}
                      >
                        <div className="h-16 w-full" style={{ backgroundColor: color }} />
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-center py-1 text-xs font-mono border-t">
                          {color.toUpperCase()}
                        </div>
                        {isPrimary && (
                          <span className="absolute top-1 left-1 text-[10px] rounded bg-purple-100 text-purple-700 px-1.5 py-0.5 border border-purple-200">Primary</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Suggested Matching Colors (AI)</label>
                {/* Assignment controls */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-gray-600">Assign to:</span>
                  {(['top','bottom','outerwear','footwear','accessory'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveSlot(k)}
                      className={`px-2 py-1 text-xs rounded border ${activeSlot === k ? 'bg-purple-600 text-white border-purple-600' : 'bg-white hover:bg-gray-50'}`}
                    >
                      {k}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-gray-500">Tip: right-click a color to copy</span>
                </div>
                {(selectedBaseColor || analysis.dominantColors[0]) && (() => {
                  const baseHex = (selectedBaseColor || analysis.dominantColors[0])
                  const simple = aiMatches || getMatchingColors(baseHex)
                  const rich = aiRichMatches

                  const Row = ({ label, colors }: { label: string; colors: string[] }) => (
                    <div className="grid grid-cols-[7rem,1fr] items-center gap-3 py-2 px-3 border-t first:border-t-0">
                      <div className="text-xs font-medium text-gray-600">{label}</div>
                      <div className="flex overflow-hidden rounded-md border h-9">
                        {colors.map((c, i) => (
                          <button
                            key={c + i}
                            type="button"
                            onClick={() => assign(c)}
                            onContextMenu={async (e) => {
                              e.preventDefault()
                              try {
                                await navigator.clipboard.writeText(c.toUpperCase())
                                toast({ variant: 'success', title: 'Copied', description: `${c.toUpperCase()} copied` })
                              } catch {
                                toast({ variant: 'error', title: 'Copy failed' })
                              }
                            }}
                            className="flex-1 relative"
                            style={{ backgroundColor: c }}
                            title={`Click to assign to ${activeSlot}. Right-click to copy ${c.toUpperCase()}`}
                          >
                            <span className="absolute bottom-0 right-0 text-[10px] font-mono bg-white/80 px-1 rounded-tl border-t border-l">{c.toUpperCase()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )

                  return (
                    <div className="rounded-md border bg-white/60">
                      <Row label="Base" colors={[baseHex]} />
                      {rich ? (
                        <>
                          <Row label="Analogous" colors={rich.analogous} />
                          <Row label="Complementary" colors={[rich.complementary]} />
                          <Row label="Split Complementary" colors={rich.splitComplementary} />
                          <Row label="Triadic" colors={rich.triadic} />
                          <Row label="Tetradic" colors={rich.tetradic} />
                          <Row label="Monochrome" colors={rich.monochrome} />
                          <Row label="Neutrals" colors={rich.neutrals} />
                          {customColors.length > 0 && <Row label="Custom" colors={customColors} />}
                        </>
                      ) : (
                        <>
                          <Row label="Complementary" colors={[simple.complementary]} />
                          <Row label="Analogous" colors={simple.analogous} />
                          <Row label="Triadic" colors={simple.triadic} />
                        </>
                      )}
                      {/* Add custom color */}
                      <div className="grid grid-cols-[7rem,1fr] items-center gap-3 py-2 px-3 border-t">
                        <div className="text-xs font-medium text-gray-600">Add Color</div>
                        <div className="flex items-center gap-2">
                          <input type="color" value={customHex} onChange={(e)=>setCustomHex(e.target.value)} className="h-7 w-9 p-0 border rounded" />
                          <input value={customHex} onChange={(e)=>setCustomHex(e.target.value)} placeholder="#000000" className="h-8 px-2 border rounded text-xs font-mono w-28" />
                          <button
                            type="button"
                            className="text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50"
                            onClick={() => {
                              const v = customHex.trim(); const hex = v.startsWith('#') ? v : `#${v}`
                              if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { toast({ variant: 'error', title: 'Invalid hex' }); return }
                              setCustomColors((prev)=> Array.from(new Set([...prev, hex.toUpperCase()])))
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      {/* Build outfit selector with live preview and resets */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                        {(['top','bottom','outerwear','footwear','accessory'] as const).map((k) => (
                          <div key={k} className="rounded border overflow-hidden">
                            <div className="px-2 py-1 text-xs font-medium capitalize flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActiveSlot(k)}
                                  className={`px-2 py-0.5 rounded border text-[11px] ${activeSlot === k ? 'bg-purple-600 text-white border-purple-600' : 'bg-white'}`}
                                >
                                  set active
                                </button>
                                <span>{k}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-gray-500">{(plan[k] || '').toUpperCase()}</span>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50"
                                  onClick={() => updatePlan(k, '')}
                                >
                                  Reset
                                </button>
                              </div>
                            </div>
                            <div className="h-10" style={{ backgroundColor: plan[k] || '#f3f4f6' }} />
                          </div>
                        ))}
                        {/* Awesomeness meter */}
                        {(() => { const m = scorePlan(); return (
                          <div className="col-span-full space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-medium">Awesomeness</span>
                              <span className="whitespace-nowrap">{m.score}% -- {m.label}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.max(0, Math.min(m.score, 100))}%`, backgroundColor: m.color }}
                              />
                            </div>
                          </div>
                        )})()}
                        <div className="col-span-full flex justify-end gap-2">
                          <button type="button" className="text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => {
                            // Auto-fill best plan
                            if (!aiRichMatches) return
                            const base = analysis?.dominantColors?.[0] || aiRichMatches.base
                            const list = (arr?: string[], n=3) => (arr||[]).filter(Boolean).slice(0,n)
                            const neutrals = list(aiRichMatches.neutrals,4)
                            const monoDeep = list((aiRichMatches.monochrome||[]).slice(0,4),3)
                            const bottoms = [aiRichMatches.complementary, ...list(aiRichMatches.analogous,2), ...list(aiRichMatches.triadic,2)].filter(Boolean)
                            const outers = [...list(aiRichMatches.tetradic,3), ...list(aiRichMatches.analogous,2)].filter(Boolean)
                            const shoes = [
                              ...neutrals,
                              ...monoDeep,
                              '#1f2937',
                              '#374151',
                              '#111827',
                              '#f5f5f5',
                            ].filter(Boolean)
                            const accs = [...neutrals, ...list(aiRichMatches.analogous,1)]
                            const toH = (hex: string) => { const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!; let r=parseInt(m[1],16)/255,g=parseInt(m[2],16)/255,b=parseInt(m[3],16)/255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2; if(max!==min){ const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;case b:h=(r-g)/d+4;break} h*=60 } return {h,s,l} }
                            const hd=(a:number,b:number)=>{const d=Math.abs(a-b);return Math.min(d,360-d)}
                            const baseH=toH(base)
                            const pair=(hex:string)=>{ const c=toH(hex); const d=hd(baseH.h,c.h); let s=0; if(d<=12)s=15; else if(d<=35)s=20; else if(d>=165&&d<=195)s=25; else if((d>=110&&d<=130)||(d>=230&&d<=250))s=20; else if((d>=80&&d<=100)||(d>=260&&d<=280))s=15; else s=10; const dl=Math.abs(baseH.l-c.l); if(dl>=0.25&&dl<=0.6)s+=5; else if(dl<0.1)s-=3; return Math.max(0,Math.min(30,s)) }
                            let best={ top: base, bottom:'', outerwear:'', footwear:'', accessory:'' }, bestScore=-1
                            for(const b of bottoms) for(const o of outers) for(const f of shoes) for(const a of accs){ const s=[b,o,f,a].reduce((acc,h)=>acc+pair(h),0); if(s>bestScore){bestScore=s; best={top:base,bottom:b,outerwear:o,footwear:f,accessory:a}} }
                            setPlan(best)
                          }}>Auto-Fill Best</button>
                          <button type="button" className="text-xs px-3 py-1 rounded border bg-white hover:bg-gray-50" onClick={() => setPlan({})}>Reset All</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(sanitizeText(e.target.value, { maxLength: 240 }))}
                placeholder="e.g., Blue cotton t-shirt, Nike sneakers"
              />
            </div>

            <Button
              onClick={handleUpload}
              className="w-full"
              disabled={uploading || !user}
              title={!user ? 'Sign in to add items' : undefined}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding to Closet...
                </>
              ) : (
                'Add to Closet'
              )}
            </Button>

            {aiRichMatches && user && (
              <Button
                onClick={async () => {
                  try {
                    await savePaletteForUser(
                      {
                        baseHex:
                          analysis.dominantColors[0] ||
                          aiRichMatches?.base ||
                          selectedBaseColor ||
                          '#000000',
                        dominantHexes: analysis.dominantColors,
                        richMatches: aiRichMatches ?? {},
                        plan,
                        source: 'closet',
                      }
                    )
                    toast({ variant: 'success', title: 'Saved palette to profile' })
                  } catch (error) {
                    if (isPermissionError(error)) {
                      toast({
                        variant: 'error',
                        title: error.reason === 'auth' ? 'Session expired' : 'Action not allowed',
                        description: error.reason === 'auth'
                          ? 'Please sign in again before saving palettes.'
                          : 'You can only save palettes to your own profile.',
                      })
                    } else {
                      toast({ variant: 'error', title: 'Save failed', description: error instanceof Error ? error.message : 'Unable to save to Supabase' })
                    }
                  }
                }}
                variant="outline"
                className="w-full"
              >
                Save Palette To Profile
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </>
  )
}

export default ImageUpload










