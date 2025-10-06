'use client'

import React, { useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Upload, Image as ImageIcon, Copy } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import { savePaletteForUser } from '@/lib/palette'
import { analyzeImageColors } from '@/lib/imageAnalysis'

type Matches = { complementary: string; analogous: string[]; triadic: string[] }

export function ColorAnalyzer() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mainColors, setMainColors] = useState<string[]>([])
  const [colorNames, setColorNames] = useState<string[] | null>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const [matches, setMatches] = useState<Matches | null>(null)
  const [rich, setRich] = useState<any | null>(null)
  const [showFull, setShowFull] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [customHex, setCustomHex] = useState<string>('#000000')

  const onChooseFile = () => fileRef.current?.click()

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(f)
  })

  const analyze = async () => {
    if (!file) return
    setIsLoading(true)
    setError(null)
    setMatches(null)
    setMainColors([])
    setColorNames(null)
    try {
      const dataUrl = await toDataUrl(file)
      // local rough hexes to constrain model
      const rough = await analyzeImageColors(file, 'enhanced')
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, dominantHexes: rough.dominantColors }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const ai = await res.json()
      setMainColors(Array.isArray(ai.dominantHexes) ? ai.dominantHexes : [])
      if (ai.matches) setMatches(ai.matches as Matches)
      if (ai.richMatches) setRich(ai.richMatches)
      if (Array.isArray(ai.colorNames)) setColorNames(ai.colorNames)
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze image')
    } finally {
      setIsLoading(false)
    }
  }

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText((hex || '').toUpperCase())
      toast({ variant: 'success', title: 'Copied', description: `${(hex || '').toUpperCase()} copied` })
    } catch {
      toast({ variant: 'error', title: 'Copy failed' })
    }
  }

  const allPaletteOptions = () => {
    const set = new Set<string>()
    const addList = (arr?: string[]) => arr?.forEach((h) => set.add((h || '').toUpperCase()))
    addList(mainColors)
    if (matches) { addList([matches.complementary, ...matches.analogous, ...matches.triadic]) }
    if (rich) {
      addList([rich.base, rich.complementary])
      addList(rich.analogous)
      addList(rich.splitComplementary)
      addList(rich.triadic)
      addList(rich.tetradic)
      addList(rich.monochrome)
      addList(rich.neutrals)
    }
    return Array.from(set)
  }

  const [plan, setPlan] = useState<{ top?: string; bottom?: string; outerwear?: string; footwear?: string; accessory?: string }>({})
  const updatePlan = (k: keyof typeof plan, v: string) => setPlan((p) => ({ ...p, [k]: v }))
  const [activeSlot, setActiveSlot] = useState<'top' | 'bottom' | 'outerwear' | 'footwear' | 'accessory'>('top')
  const assign = (hex: string) => updatePlan(activeSlot, hex)

  // Awesomeness meter
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
    const base = mainColors[0] || rich?.base
    const baseH = toHsl(base)
    const chosen = Object.values(plan).filter(Boolean) as string[]
    if (!baseH || chosen.length === 0) return { score: 0, label: 'Start choosing', color: '#9ca3af' }
    let sum = 0
    chosen.forEach((hex) => {
      const c = toHsl(hex)!
      const d = hueDist(baseH.h, c.h)
      let s = 0
      if (d <= 12) s = 15 // monochrome
      else if (d >= 15 && d <= 35) s = 20 // analogous
      else if (d >= 165 && d <= 195) s = 25 // complementary
      else if ((d >= 110 && d <= 130) || (d >= 230 && d <= 250)) s = 20 // triadic band
      else if ((d >= 80 && d <= 100) || (d >= 260 && d <= 280)) s = 15 // tetradic-ish
      else s = 10 // neutral/other
      // lightness contrast bonus
      const dl = Math.abs(baseH.l - c.l)
      if (dl >= 0.25 && dl <= 0.6) s += 5
      else if (dl < 0.1) s -= 3
      // cap
      s = Math.max(0, Math.min(30, s))
      sum += s
    })
    const score = Math.round((sum / (chosen.length * 30)) * 100)
    let label = 'Okay'
    let color = '#f59e0b' // amber
    if (score < 40) { label = 'Needs work'; color = '#ef4444' }
    else if (score < 70) { label = 'Good'; color = '#f59e0b' }
    else if (score < 85) { label = 'Great'; color = '#10b981' }
    else { label = 'Awesome'; color = '#16a34a' }
    return { score, label, color }
  }

  // Auto-fill best matching plan from rich palette
  const autoFillBest = () => {
    if (!rich) return
    const base = mainColors[0] || rich.base
    const opts = (arr?: string[], n = 3) => (arr || []).filter(Boolean).slice(0, n)
    const bottoms = [rich.complementary, ...opts(rich.analogous, 2), ...opts(rich.triadic, 2)].filter(Boolean)
    const outers = [...opts(rich.tetradic, 3), ...opts(rich.analogous, 2)]
    const shoes = [...opts(rich.monochrome.slice(-3), 3), ...opts(rich.triadic, 2)]
    const accs = [...opts(rich.neutrals, 4), ...opts(rich.analogous, 1)]

    let best = { top: base, bottom: '', outerwear: '', footwear: '', accessory: '' }
    let bestScore = -1
    const toH = (hex: string) => {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)!
      let r = int(m[1]) / 255, g = int(m[2]) / 255, b = int(m[3]) / 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let h = 0, s = 0, l = (max + min) / 2
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; case b: h = (r - g) / d + 4; break }
        h *= 60
      }
      return { h, s, l }
    }
    const int = (x: string) => parseInt(x, 16)
    const hd = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 360 - d) }
    const baseH = toH(base)
    const scorePair = (hex: string) => {
      const c = toH(hex)
      const d = hd(baseH.h, c.h)
      let s = 0
      if (d <= 12) s = 15; else if (d <= 35) s = 20; else if (d >= 165 && d <= 195) s = 25; else if ((d >= 110 && d <= 130) || (d >= 230 && d <= 250)) s = 20; else if ((d >= 80 && d <= 100) || (d >= 260 && d <= 280)) s = 15; else s = 10
      const dl = Math.abs(baseH.l - c.l); if (dl >= 0.25 && dl <= 0.6) s += 5; else if (dl < 0.1) s -= 3
      return Math.max(0, Math.min(30, s))
    }

    for (const b of bottoms) for (const o of outers) for (const f of shoes) for (const a of accs) {
      const s = [b,o,f,a].reduce((acc, h) => acc + scorePair(h), 0)
      if (s > bestScore) { bestScore = s; best = { top: base, bottom: b, outerwear: o, footwear: f, accessory: a } }
    }
    setPlan(best)
  }
  const saveToProfile = async () => {
    if (!user || !rich) {
      toast({ variant: 'error', title: !user ? 'Please sign in' : 'Nothing to save' })
      return
    }
    try {
      const base = mainColors[0] || rich.base
      await savePaletteForUser(
        {
          baseHex: base,
          dominantHexes: mainColors,
          richMatches: rich,
          plan,
          source: 'analyzer',
        }
      )
      toast({ variant: 'success', title: 'Saved to profile' })
    } catch (e: any) {
      toast({ variant: 'error', title: 'Save failed', description: e?.message || 'Unable to write to Firestore' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="mr-2 h-5 w-5" />
          Clothing Color Analyzer
        </CardTitle>
        <CardDescription>
          Upload a piece of clothing to get matching color suggestions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          {preview ? (
            <div className="space-y-4">
              <img src={preview} alt="Preview" className="max-w-full max-h-64 mx-auto rounded" />
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={onChooseFile}>Change Image</Button>
                <Button onClick={analyze} disabled={isLoading}>
                  {isLoading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>) : 'Analyze Colors'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div>
                <Button onClick={onChooseFile}>Choose File</Button>
                <p className="text-sm text-gray-500 mt-2">PNG or JPG up to 10MB</p>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {mainColors.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Analysis Results</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">Main Colors</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {mainColors.map((hex: string, i: number) => (
                      <button
                        key={hex + i}
                        type="button"
                        onClick={() => copyHex(hex)}
                        className="group relative rounded-md overflow-hidden border shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        title={`Copy ${hex.toUpperCase()}`}
                      >
                        <div className="h-20 w-full" style={{ backgroundColor: hex }} />
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 text-center py-1 text-xs font-mono border-t">
                          {hex.toUpperCase()}
                        </div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded p-1 border">
                          <Copy className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {(rich || matches) && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Suggested Matching Colors</div>
                      <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={showFull}
                          onChange={(e) => setShowFull(e.target.checked)}
                        />
                        Show full palette
                      </label>
                    </div>
                    {/* Assignment target */}
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
                    <div className="space-y-3">
                      {(() => {
                        const rows = rich ? [
                          ...(showFull ? [
                            { label: 'Monochrome', colors: rich.monochrome as string[] },
                            { label: 'Analogous', colors: rich.analogous as string[] },
                            { label: 'Complementary', colors: [rich.complementary] as string[] },
                            { label: 'Split Complementary', colors: rich.splitComplementary as string[] },
                            { label: 'Triadic', colors: rich.triadic as string[] },
                            { label: 'Tetradic', colors: rich.tetradic as string[] },
                            { label: 'Neutrals', colors: rich.neutrals as string[] },
                            ...(customColors.length ? [{ label: 'Custom', colors: customColors }] : []),
                          ] : [
                            { label: 'Complementary', colors: [rich.complementary] as string[] },
                            { label: 'Analogous', colors: rich.analogous as string[] },
                            { label: 'Triadic', colors: rich.triadic as string[] },
                            ...(customColors.length ? [{ label: 'Custom', colors: customColors }] : []),
                          ]),
                        ] : [
                          { label: 'Complementary', colors: [matches!.complementary] },
                          { label: 'Analogous', colors: matches!.analogous },
                          { label: 'Triadic', colors: matches!.triadic },
                        ]
                        return rows
                      })().map((row) => (
                        <div key={row.label} className="grid grid-cols-[8rem,1fr] items-center gap-3">
                          <div className="text-xs text-gray-600 font-medium">{row.label}</div>
                          <div className="flex overflow-hidden rounded-md border h-10">
                            {row.colors.map((hex, idx) => (
                              <button
                                key={hex + idx}
                                type="button"
                                onClick={() => assign(hex)}
                                onContextMenu={(e) => { e.preventDefault(); copyHex(hex) }}
                                className="flex-1 relative"
                                style={{ backgroundColor: hex }}
                                title={`Click to assign to ${activeSlot}. Right-click to copy ${hex.toUpperCase()}`}
                              >
                                <span className="absolute bottom-0 right-0 text-[10px] font-mono bg-white/80 px-1 rounded-tl border-t border-l">
                                  {hex.toUpperCase()}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Add custom color */}
                      <div className="grid grid-cols-[8rem,1fr] items-center gap-3">
                        <div className="text-xs text-gray-600 font-medium">Add Color</div>
                        <div className="flex items-center gap-2">
                          <input type="color" value={customHex} onChange={(e)=>setCustomHex(e.target.value)} className="h-8 w-10 p-0 border rounded" />
                          <input
                            value={customHex}
                            onChange={(e)=>setCustomHex(e.target.value)}
                            placeholder="#000000"
                            className="h-8 px-2 border rounded text-xs font-mono w-28"
                          />
                          <Button
                            variant="outline"
                            className="h-8 px-3"
                            onClick={() => {
                              const v = customHex.trim()
                              const hex = v.startsWith('#') ? v : `#${v}`
                              if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { toast({ variant: 'error', title: 'Invalid hex' }); return }
                              setCustomColors((prev) => Array.from(new Set([...prev, hex.toUpperCase()])))
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {rich && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm font-medium">Build Outfit From Palette</div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={autoFillBest} disabled={!rich}>Auto-Fill Best</Button>
                      </div>
                    </div>
                    {/* Live preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(['top','bottom','outerwear','footwear','accessory'] as const).map((k) => (
                        <div key={k} className={`rounded border overflow-hidden`}> 
                          <div className="px-3 py-2 text-xs font-medium capitalize flex items-center justify-between">
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
                              <span className="font-mono text-[11px] text-gray-500">{(plan[k] || '').toUpperCase()}</span>
                              <button
                                type="button"
                                className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50"
                                onClick={() => updatePlan(k, '')}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                          <div className="h-14" style={{ backgroundColor: plan[k] || '#f3f4f6' }} />
                        </div>
                      ))}
                    </div>
                    {/* Awesomeness meter */}
                    {(() => { const m = scorePlan(); return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">Awesomeness</span>
                          <span>{m.score}% - {m.label}</span>
                        </div>
                        <div className="h-2 rounded bg-gray-200 overflow-hidden">
                          <div className="h-full" style={{ width: `${m.score}%`, backgroundColor: m.color, transition: 'width .2s ease' }} />
                        </div>
                      </div>
                    )})()}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setPlan({})}>Reset All</Button>
                      <Button onClick={saveToProfile} disabled={!user}>
                        {user ? 'Save to Profile' : 'Sign in to Save'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ColorAnalyzer
