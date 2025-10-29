import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { summariseClosetForPrompt } from '@/lib/closet'
import { getOnlinePieces, summarisePiecesForPrompt } from '@/lib/fashionPieces'
import { callMistralAI } from '@/lib/genkit'
import type { GenderTarget } from '@/types/arrivals'

type OutfitSource = 'closet' | 'online'

interface PieceRecommendation {
  summary: string
  color?: string
  source?: OutfitSource
  sourceUrl?: string
  onlinePieceId?: string
}

interface StructuredOutfit {
  top: PieceRecommendation
  bottom: PieceRecommendation
  footwear: PieceRecommendation
  accessories: PieceRecommendation[]
  outerwear?: PieceRecommendation
  styleNotes: string
}

const FORMAL_KEYWORDS = ['business', 'meeting', 'board', 'office', 'corporate', 'interview', 'pitch']

const FORMAL_FALLBACK_MALE: StructuredOutfit = {
  top: {
    summary: 'Charcoal spread-collar dress shirt with crisp placket',
    color: 'charcoal',
    source: 'online',
    sourceUrl: 'https://sutrastores.com/products/charcoal-business-shirt',
    onlinePieceId: 'sutra-charcoal-dress-shirt',
  },
  bottom: {
    summary: 'Navy tailored trousers with pressed crease',
    color: 'navy',
    source: 'online',
    sourceUrl: 'https://sutrastores.com/products/navy-tailored-trouser',
    onlinePieceId: 'sutra-navy-trouser',
  },
  footwear: {
    summary: 'Black polished leather oxford shoes',
    color: 'black',
    source: 'online',
    sourceUrl: 'https://concrete.com.eg/products/black-leather-oxford',
    onlinePieceId: 'concrete-leather-oxford',
  },
  accessories: [
    { summary: 'Minimal stainless watch or slim leather folio', color: 'silver', source: 'closet' },
  ],
  outerwear: {
    summary: 'Optional navy blazer to sharpen boardroom presence',
    color: 'navy',
    source: 'online',
    sourceUrl: 'https://mamzistore.com/products/ivory-structured-blazer',
    onlinePieceId: 'mamzi-ivory-blazer',
  },
  styleNotes: 'Keep it boardroom-ready with a crisp shirt, pressed trousers, and polished Oxfords. Layer a blazer when the agenda leans formal.',
}

const FORMAL_FALLBACK_FEMALE: StructuredOutfit = {
  top: {
    summary: 'Ivory structured blazer layered over silk blouse',
    color: 'ivory',
    source: 'online',
    sourceUrl: 'https://mamzistore.com/products/ivory-structured-blazer',
    onlinePieceId: 'mamzi-ivory-blazer',
  },
  bottom: {
    summary: 'Graphite pencil skirt with satin waistband',
    color: 'graphite',
    source: 'online',
    sourceUrl: 'https://mamzistore.com/products/graphite-pencil-skirt',
    onlinePieceId: 'mamzi-pencil-skirt',
  },
  footwear: {
    summary: 'Black pointed heel with supportive footbed',
    color: 'black',
    source: 'online',
    sourceUrl: 'https://mamzistore.com/products/black-pointed-heel',
    onlinePieceId: 'mamzi-pointed-heel',
  },
  accessories: [
    { summary: 'Structured tote or minimal jewelry', color: 'gold', source: 'closet' },
  ],
  styleNotes: 'Compose a refined silhouette with a blazer-and-skirt pairing, elevated heels, and understated accessories suitable for executive meetings.',
}

const selectFormalFallback = (gender?: GenderTarget | undefined): StructuredOutfit => {
  if (gender === 'female') return FORMAL_FALLBACK_FEMALE
  return FORMAL_FALLBACK_MALE
}

const needsFormalDressCode = (occasion?: string | null): boolean => {
  if (!occasion) return false
  const lowered = occasion.toLowerCase()
  return FORMAL_KEYWORDS.some((keyword) => lowered.includes(keyword))
}

const applyOccasionAdjustments = (outfit: StructuredOutfit, occasion?: string | null, gender?: GenderTarget | undefined): StructuredOutfit => {
  if (!needsFormalDressCode(occasion)) {
    return outfit
  }
  const invalidTop = /(tee|t-shirt|tank|hoodie|sweatshirt|recommended top)/i.test(outfit.top.summary)
  const invalidBottom = /(short|jogger|jean|denim|track|recommended bottom)/i.test(outfit.bottom.summary)
  const invalidFootwear = /(sneaker|trainer|flip|sandal|slide|recommended footwear)/i.test(outfit.footwear.summary)

  if (!invalidTop && !invalidBottom && !invalidFootwear) {
    return outfit
  }

  const fallback = selectFormalFallback(gender)
  return {
    ...fallback,
    accessories: outfit.accessories.length ? outfit.accessories : fallback.accessories,
    styleNotes: fallback.styleNotes,
  }
}

const ClosetItemSchema = z.object({
  id: z.string(),
  garmentType: z.enum(['top', 'bottom', 'footwear', 'accessory', 'outerwear']),
  brand: z.string().optional(),
  description: z.string().optional(),
  dominantColors: z.array(z.string()).optional(),
})

const InputSchema = z.object({
  occasion: z.string(),
  weather: z.object({
    temperature: z.number(),
    condition: z.string(),
    humidity: z.number(),
    location: z.string(),
  }),
  userProfile: z
    .object({
      gender: z.string().optional(),
      age: z.number().optional(),
      favoriteColors: z.array(z.string()).optional(),
      dislikedColors: z.array(z.string()).optional(),
      favoriteStyles: z.array(z.string()).optional(),
    })
    .optional(),
  userId: z.string().optional(),
  closetItems: z.array(ClosetItemSchema).optional(),
})

const normalizeGender = (value?: string | null): GenderTarget | undefined => {
  if (!value) return undefined
  const lowered = value.toLowerCase()
  if (lowered === 'male' || lowered === 'man' || lowered === 'mens') return 'male'
  if (lowered === 'female' || lowered === 'woman' || lowered === 'womens') return 'female'
  if (lowered === 'unisex') return 'unisex'
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const input = InputSchema.parse(body)

    const targetGender = normalizeGender(input.userProfile?.gender)
    const closetItems = input.closetItems ?? []
    const onlinePieces = await getOnlinePieces(targetGender, input.occasion)

    const onlineLookup = new Map(onlinePieces.map((piece) => [piece.id, piece]))
    const onlinePiecesPayload = JSON.stringify(
      onlinePieces.map((piece) => ({
        id: piece.id,
        title: piece.title,
        brand: piece.brand,
        price: piece.price,
        categories: piece.categories,
        highlights: piece.highlights,
        sourceUrl: piece.sourceUrl,
        store: piece.store,
      })),
      null,
      2,
    )

    const closetSummary = summariseClosetForPrompt(closetItems)
    const onlineSummary = summarisePiecesForPrompt(onlinePieces, 12)

    const systemPrompt = `You are a professional fashion stylist AI. Build outfits using the user's own closet items whenever possible. Only recommend items from the online catalog when the closet is missing a needed piece or when offering an optional upgrade - make it clear when something is a shopping recommendation.

Respond ONLY with a valid JSON object matching exactly this schema (no markdown fences, no extra text):
{
  "top": { "summary": string, "color": string, "source": "closet" | "online", "onlinePieceId"?: string, "sourceUrl"?: string },
  "bottom": { "summary": string, "color": string, "source": "closet" | "online", "onlinePieceId"?: string, "sourceUrl"?: string },
  "footwear": { "summary": string, "color": string, "source": "closet" | "online", "onlinePieceId"?: string, "sourceUrl"?: string },
  "accessories": [
    { "summary": string, "color": string, "source": "closet" | "online", "onlinePieceId"?: string, "sourceUrl"?: string }
  ],
  "outerwear"?: { "summary": string, "color": string, "source": "closet" | "online", "onlinePieceId"?: string, "sourceUrl"?: string },
  "styleNotes": string
}

Rules:
- Always set "source" to "closet" when the item comes from the user's closet inventory. Set it to "online" only when you select a product from the provided online catalog.
- Whenever you choose an online item, include "onlinePieceId" matching the catalog id and provide its "sourceUrl".
- Provide a descriptive "color" for every garment (estimate when not stated explicitly).
- Accessories should follow the same object shape as other pieces.
- If outerwear is unnecessary, omit it entirely.
- Keep "styleNotes" concise (no more than 2-3 sentences) with practical guidance.`

    const closetBlock = closetSummary.length
      ? ['Closet Inventory (prioritise these pieces):', ...closetSummary].join('\n')
      : 'Closet Inventory: No items provided.'

    const onlineBlock = onlineSummary.length
      ? ['Online Store Highlights (mention source if you use one):', ...onlineSummary].join('\n')
      : 'Online Store Highlights: None available.'

    const occasionGuidance = needsFormalDressCode(input.occasion)
      ? 'Occasion directives: Choose collared shirts, tailored trousers or skirts, polished footwear, and optional blazer. Avoid shorts, casual tees, or athleisure.'
      : 'Occasion directives: Match the vibe of the event while staying weather appropriate.'

    const prompt = `Please suggest a complete outfit for the following context. Use closet items first; supplement with the online highlights only if needed.

Occasion: ${input.occasion}
Weather: ${input.weather.temperature} degC, ${input.weather.condition} in ${input.weather.location}
Humidity: ${input.weather.humidity}%

User Profile:
- Gender: ${input.userProfile?.gender || 'not specified'}
- Age: ${input.userProfile?.age || 'not specified'}
- Favorite Colors: ${input.userProfile?.favoriteColors?.join(', ') || 'none specified'}
- Disliked Colors: ${input.userProfile?.dislikedColors?.join(', ') || 'none specified'}
- Favorite Styles: ${input.userProfile?.favoriteStyles?.join(', ') || 'none specified'}

${occasionGuidance}

${closetBlock}

${onlineBlock}

Online Catalog JSON (each entry is eligible for online picks, reference id when using one):
${onlinePiecesPayload}

Provide a detailed outfit recommendation and clear style notes. Reference the item names when you use them, spotlight favourite colours, and deliberately avoid any listed dislikes.`

    const response = await callMistralAI(prompt, systemPrompt, { responseFormat: { type: 'json_object' } })

    const tryParse = (text: string): unknown => {
      try {
        return JSON.parse(text)
      } catch {}
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
      if (match) {
        try {
          return JSON.parse(match[1])
        } catch {}
      }
      return null
    }

    const toPiece = (raw: unknown, label: string): PieceRecommendation => {
      if (!raw) {
        return { summary: label, source: 'closet' }
      }
      if (typeof raw === 'string') {
        return { summary: raw, source: 'closet' }
      }
      if (typeof raw !== 'object') {
        return { summary: label, source: 'closet' }
      }
      const candidateRaw = raw as Record<string, unknown>
      const candidateSummary = (() => {
        const summaryValue = candidateRaw.summary
        if (typeof summaryValue === 'string' && summaryValue.trim().length > 0) return summaryValue
        const itemValue = candidateRaw.item
        if (typeof itemValue === 'string' && itemValue.trim().length > 0) return itemValue
        const descriptionValue = candidateRaw.description
        if (typeof descriptionValue === 'string' && descriptionValue.trim().length > 0) return descriptionValue
        const textValue = candidateRaw.text
        if (typeof textValue === 'string' && textValue.trim().length > 0) return textValue
        return ''
      })()
      const summary = candidateSummary || label
      let color = typeof candidateRaw.color === 'string' ? candidateRaw.color : typeof (candidateRaw.colour as string) === 'string' ? (candidateRaw.colour as string) : undefined
      const sourceValue = typeof candidateRaw.source === 'string' ? (candidateRaw.source as string).toLowerCase() : undefined
      let source: OutfitSource = sourceValue === 'online' ? 'online' : 'closet'
      let onlinePieceId = typeof candidateRaw.onlinePieceId === 'string' ? (candidateRaw.onlinePieceId as string) : undefined
      if (!onlinePieceId && typeof candidateRaw.id === 'string') {
        onlinePieceId = candidateRaw.id as string
      }
      let sourceUrl = typeof candidateRaw.sourceUrl === 'string' ? (candidateRaw.sourceUrl as string) : undefined

      let matched = onlinePieceId ? onlineLookup.get(onlinePieceId) : undefined
      if (!matched && source === 'online') {
        if (sourceUrl) {
          matched = Array.from(onlineLookup.values()).find((piece) => piece.sourceUrl === sourceUrl)
        }
        if (!matched && summary) {
          matched = Array.from(onlineLookup.values()).find((piece) => summary.toLowerCase().includes(piece.title.toLowerCase()))
        }
      }

      if (matched) {
        onlinePieceId = matched.id
        if (!sourceUrl && matched.sourceUrl) sourceUrl = matched.sourceUrl
        source = 'online'
        if (!color && matched.highlights && matched.highlights.length > 0) {
          const colourHighlight = matched.highlights.find((highlight) => /(red|blue|green|black|white|beige|navy|pink|purple|orange|yellow|brown|grey|gray|silver|gold)/i.test(highlight))
          if (colourHighlight) {
            const parts = colourHighlight.split(/[:,-]/)
            color = (parts.length > 0 ? parts[0] : colourHighlight).trim()
          }
        }
      }

      return {
        summary,
        color,
        source,
        sourceUrl,
        onlinePieceId,
      }
    }

    const buildResponse = (raw: unknown): StructuredOutfit | null => {
      if (!raw || typeof raw !== 'object') return null
      const rawRecord = raw as Record<string, unknown>
      const candidateBase =
        (rawRecord.top && rawRecord.bottom && rawRecord.footwear ? rawRecord : undefined) ??
        (rawRecord.outfitRecommendation as Record<string, unknown> | undefined) ??
        (rawRecord.outfit as Record<string, unknown> | undefined) ??
        (rawRecord.recommendation as Record<string, unknown> | undefined)
      const candidate = (candidateBase ?? rawRecord) as Record<string, unknown>
      const topPiece = toPiece(candidate.top, 'Top')
      const bottomPiece = toPiece(candidate.bottom, 'Bottom')
      const footwearPiece = toPiece(candidate.footwear, 'Footwear')
      const accessoriesSource: unknown[] = Array.isArray(candidate.accessories)
        ? (candidate.accessories as unknown[])
        : Array.isArray(rawRecord.accessories)
          ? (rawRecord.accessories as unknown[])
          : []
      const accessoriesPieces = accessoriesSource
        .map((item: unknown, index: number): PieceRecommendation => toPiece(item, `Accessory ${index + 1}`))
        .filter((piece: PieceRecommendation) => Boolean(piece.summary))
      const outerwearPiece = candidate.outerwear ? toPiece(candidate.outerwear, 'Outerwear') : undefined

      const noteCandidates: string[] = []
      const pushText = (value?: unknown) => {
        if (typeof value === 'string' && value.trim()) {
          noteCandidates.push(value.trim())
        } else if (Array.isArray(value)) {
          const text = value.filter((v) => typeof v === 'string') as string[]
          if (text.length) {
            noteCandidates.push(text.join(' ').trim())
          }
        }
      }
      pushText(candidate.styleNotes)
      pushText(rawRecord.styleNotes)
      pushText(candidate.notes)
      pushText(rawRecord.notes)
      const weatherAdaptation = candidate.weatherAdaptation as { notes?: unknown } | undefined
      pushText(weatherAdaptation?.notes)
      const styleNotes = noteCandidates.find(Boolean) || ''

      if (!topPiece.summary || !bottomPiece.summary || !footwearPiece.summary) {
        return null
      }

      return {
        top: topPiece,
        bottom: bottomPiece,
        footwear: footwearPiece,
        accessories: accessoriesPieces,
        outerwear: outerwearPiece,
        styleNotes,
      }
    }

    const parsed = tryParse(response)
    const normalized = buildResponse(parsed)
    if (normalized) {
      return NextResponse.json(applyOccasionAdjustments(normalized, input.occasion, targetGender))
    }

    return NextResponse.json(
      applyOccasionAdjustments(
        selectFormalFallback(targetGender),
        input.occasion,
        targetGender,
      ),
    )
  } catch (error: unknown) {
    console.error('Outfit suggestion error:', error)
    const message =
      typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : String(error)
    return NextResponse.json(
      { error: 'Failed to generate outfit suggestion', details: message },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Outfit suggestion API is running' }, { status: 200 })
}
