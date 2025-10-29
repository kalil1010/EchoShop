'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, Loader2, Maximize2, Sparkles } from 'lucide-react'

import { generateImage } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

interface GeneratedImageItem {
  id: string
  prompt: string
  url: string
  fileId: string | null
  contentType: string
  createdAt: Date
  persistentUrl?: string
  storagePath?: string
}

const promptPresets = [
  'Editorial photoshoot of a futuristic streetwear look with iridescent fabrics and soft rim lighting',
  'Minimalist flat lay of capsule wardrobe essentials in neutral earth tones on textured linen backdrop',
  'Runway-inspired evening gown featuring dramatic draping and cinematic moody lighting',
]

const MAX_HISTORY = 4

const toFilename = (prompt: string, extension: string) => {
  const normalized = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const slug = normalized || 'zmoda-image'
  return `${slug}.${extension}`
}

export function ImageGenerator() {
  const { toast } = useToast()
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [results, setResults] = useState<GeneratedImageItem[]>([])
  const urlRegistry = useRef<Set<string>>(new Set())
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [lightboxCaption, setLightboxCaption] = useState<string | undefined>(undefined)

  useEffect(() => {
    const registry = urlRegistry.current
    return () => {
      registry.forEach((url) => URL.revokeObjectURL(url))
      registry.clear()
    }
  }, [])

  const canSubmit = prompt.trim().length >= 4 && !isGenerating

  const helperText = useMemo(() => {
    if (!prompt.trim()) {
      return 'Describe the vibe, outfit details, lighting, or camera style you want to see.'
    }
    if (prompt.length < 12) {
      return 'Add a bit more detail for best results - think fabrics, colors, or setting.'
    }
    return 'Great! Press generate to bring it to life.'
  }, [prompt])

  const openLightbox = useCallback(
    (url?: string | null, caption?: string) => {
      if (!url) {
        toast({
          variant: 'warning',
          title: 'Preview unavailable',
          description: 'Generate again to refresh the image URL.',
        })
        return
      }
      setLightboxImage(url)
      setLightboxCaption(caption)
    },
    [toast],
  )

  const closeLightbox = useCallback(() => {
    setLightboxImage(null)
    setLightboxCaption(undefined)
  }, [])

  const handleGenerate = async () => {
    const cleanedPrompt = prompt.trim()
    if (!cleanedPrompt) {
      toast({
        variant: 'error',
        title: 'Missing prompt',
        description: 'Describe the image you want before generating.',
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await generateImage({
        prompt: cleanedPrompt,
        purpose: 'concept',
      })
      const objectUrl = URL.createObjectURL(response.blob)
      urlRegistry.current.add(objectUrl)

      setResults((prev) => {
        const entry: GeneratedImageItem = {
          id: `${Date.now()}`,
          prompt: cleanedPrompt,
          url: objectUrl,
          fileId: response.fileId,
          contentType: response.contentType,
          createdAt: new Date(),
          persistentUrl: response.avatarUrl,
          storagePath: response.storagePath,
        }

        const next = [entry, ...prev]
        if (next.length <= MAX_HISTORY) {
          return next
        }

        const overflow = next.slice(MAX_HISTORY)
        overflow.forEach((item) => {
          if (urlRegistry.current.has(item.url)) {
            URL.revokeObjectURL(item.url)
            urlRegistry.current.delete(item.url)
          }
        })
        return next.slice(0, MAX_HISTORY)
      })

      toast({
        variant: 'default',
        title: 'Image ready',
        description: 'Download or iterate on the result below.',
      })
    } catch (error) {
      console.error('Image generation error:', error)
      toast({
        variant: 'error',
        title: 'Generation failed',
        description:
          error instanceof Error
            ? error.message
            : 'We could not generate an image at the moment. Please try again.',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (item: GeneratedImageItem) => {
    const extension = item.contentType.includes('png')
      ? 'png'
      : item.contentType.includes('jpeg')
      ? 'jpg'
      : 'png'
    const link = document.createElement('a')
    link.href = item.url
    link.download = toFilename(item.prompt, extension)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Fashion Image Lab
          </CardTitle>
          <CardDescription>
            Use the dedicated Mistral image agent to turn your ideas into high-quality outfit visuals. Prompts stay on the server so API keys never touch the browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="image-generator-prompt" className="text-sm font-medium text-slate-700">
              Prompt
            </label>
            <Textarea
              id="image-generator-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Cinematic portrait of a model wearing a monochrome athleisure set with soft morning light"
              disabled={isGenerating}
              className="min-h-[120px]"
            />
            <p className="text-xs text-slate-500">{helperText}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {promptPresets.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-purple-400 hover:text-purple-600 transition-colors"
                disabled={isGenerating}
              >
                {example}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Outputs are served directly from the backend using Railway-managed keys.
            </div>
            <Button type="button" onClick={handleGenerate} disabled={!canSubmit} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Generating...' : 'Generate image'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent generations</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((item) => (
              <Card key={item.id} className="overflow-hidden border-slate-200">
                <button
                  type="button"
                  className="relative aspect-square w-full overflow-hidden bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                  onClick={() =>
                    openLightbox(
                      item.persistentUrl ?? item.url,
                      `Generated image — ${item.createdAt.toLocaleString()}`,
                    )
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.persistentUrl ?? item.url}
                    alt={item.prompt}
                    className="h-full w-full object-cover transition-transform duration-150 hover:scale-[1.02]"
                  />
                  <span className="absolute bottom-3 right-3 inline-flex items-center rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white">
                    <Maximize2 className="mr-1 h-3 w-3" />
                    Preview
                  </span>
                </button>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Prompt</p>
                    <p className="text-sm text-slate-600">{item.prompt}</p>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-slate-500">
                    <div className="flex items-center justify-between gap-3">
                      <span>{item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {item.fileId && (
                        <span className="truncate text-right" title={item.fileId}>
                          File ID: {item.fileId}
                        </span>
                      )}
                    </div>
                    {item.storagePath && (
                      <span className="truncate" title={item.storagePath}>
                        Stored at: {item.storagePath}
                      </span>
                    )}
                    {item.persistentUrl && (
                      <span className="truncate" title={item.persistentUrl}>
                        Public URL ready
                      </span>
                    )}
                  </div>
                  {item.persistentUrl && (
                    <a
                      href={item.persistentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      Open full image
                    </a>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full gap-2"
                    onClick={() => handleDownload(item)}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ImageLightbox
        open={Boolean(lightboxImage)}
        imageUrl={lightboxImage}
        caption={lightboxCaption}
        onClose={closeLightbox}
      />
    </div>
  )
}
