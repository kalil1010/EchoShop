import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { summariseClosetForPrompt } from '@/lib/closet'
import { getOnlinePieces, summarisePiecesForPrompt } from '@/lib/fashionPieces'
import { callMistralAI } from '@/lib/genkit'
import { generateImageFromPrompt } from '@/lib/mistralImage'
import { getSupabaseStorageConfig } from '@/lib/supabaseClient'
import { createServiceClient, getAuthenticatedUserId } from '@/lib/supabaseServer'
import type { GenderTarget } from '@/types/arrivals'
import {
  buildErrorStructuredReply,
  normaliseStructuredReply,
  renderStructuredReply,
  type StructuredStylistReply,
} from '@/lib/stylistFormatting'

const ClosetItemSchema = z.object({
  id: z.string(),
  garmentType: z.enum(['top', 'bottom', 'footwear', 'accessory', 'outerwear']),
  brand: z.string().optional(),
  description: z.string().optional(),
  dominantColors: z.array(z.string()).optional(),
})

const PayloadSchema = z.object({
  message: z.string().min(1),
  context: z.string().optional(),
  userProfile: z
    .object({
      displayName: z.string().optional(),
      gender: z.string().optional(),
      age: z.number().optional(),
      favoriteColors: z.array(z.string()).optional(),
      dislikedColors: z.array(z.string()).optional(),
      favoriteStyles: z.array(z.string()).optional(),
      stylePreferences: z.array(z.string()).optional(),
    })
    .optional(),
  closetItems: ClosetItemSchema.array().optional(),
  imageColors: z.array(z.string()).optional(),
  mode: z.enum(['assistant', 'stylist']).optional(),
})

const normalizeGender = (value?: string | null): GenderTarget | undefined => {
  if (!value) return undefined
  const lowered = value.toLowerCase()
  if (lowered === 'male' || lowered === 'man' || lowered === 'mens') return 'male'
  if (lowered === 'female' || lowered === 'woman' || lowered === 'womens') return 'female'
  if (lowered === 'unisex') return 'unisex'
  return undefined
}

const OUTFIT_KEYWORDS = [
  'outfit',
  'wear',
  'look',
  'attire',
  'ensemble',
  'garment',
  'style me',
  'dress me',
  'suit',
  'what should i wear',
  'put together',
  'coordinate',
  'suggest',
  'recommend',
  'styling idea',
]

const isOutfitRequest = (message: string | undefined | null): boolean => {
  if (!message) return false
  const text = message.toLowerCase().trim()
  if (!text) return false

  if (/what should i wear|show me (an )?outfit|suggest (an )?outfit|outfit idea|outfit for/i.test(text)) {
    return true
  }

  const hasDirective = /(?:show|suggest|recommend|create|build|plan|put together|style|dress)\b/.test(text)
  const hasClothingKeyword = OUTFIT_KEYWORDS.some((keyword) => text.includes(keyword))
  if (text.includes('outfit')) return true
  if (hasDirective && hasClothingKeyword) return true
  if (text.includes('what to wear')) return true
  return false
}

const STRUCTURED_RESPONSE_SCHEMA = `{
  "structured": {
    "header": "Hi [Name]! Here are two looks tailored to your vibe.",
    "outfits": [
      {
        "title": "City Sleek",
        "summary": "Polished layers for a breezy day.",
        "pieces": [
          { "type": "Top", "description": "Cropped lilac hoodie with soft fleece lining", "color": "Soft Lilac", "hex": "#CBB4DA" },
          { "type": "Bottom", "description": "High-waist cream joggers with tapered leg", "color": "Warm Cream" },
          { "type": "Shoes", "description": "White leather sneakers", "color": "Cloud White" },
          { "type": "Accessories", "description": "Silver hoop earrings from your closet", "color": "Silver" }
        ]
      },
      {
        "title": "Weekend Ease",
        "summary": "Relaxed denim layers for casual plans.",
        "pieces": [
          { "type": "Top", "description": "Dusty blue oversized tee", "color": "Dusty Blue" },
          { "type": "Bottom", "description": "Soft charcoal straight-leg jeans", "color": "Charcoal" },
          { "type": "Shoes", "description": "Tan suede loafers", "color": "Warm Tan" }
        ]
      }
    ],
    "colors": {
      "complementary": ["Soft Lilac", "Warm Sand"],
      "analogous": ["Lavender", "Sky Blue"],
      "neutrals": ["Cloud White", "Soft Charcoal"]
    },
    "tips": [
      "Layer a cropped denim jacket if the evening breeze picks up.",
      "Swap the trainers for loafers to dress things up for dinner."
    ],
    "followUp": "Which outfit feels right today? Want me to remix another vibe?"
  }
}`

const parseJsonBlock = (payload: string): unknown => {
  const trimmed = payload.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (match) {
      try {
        return JSON.parse(match[1]) as unknown
      } catch {
        return null
      }
    }
  }
  return null
}

const toExtension = (contentType: string): string => {
  const lowered = contentType.toLowerCase()
  if (lowered.includes('png')) return 'png'
  if (lowered.includes('jpeg') || lowered.includes('jpg')) return 'jpg'
  if (lowered.includes('webp')) return 'webp'
  return 'png'
}

const sanitizeLine = (line: string): string => {
  return line.replace(/^[-*#>\s]+/, '').trim()
}

const buildCaption = (candidate?: string, structured?: StructuredStylistReply): string => {
  const safeCandidate = candidate?.trim()
  if (safeCandidate) return safeCandidate
  if (structured?.header) {
    const cleaned = sanitizeLine(structured.header).replace(/^\*+|\*+$/g, '').trim()
    if (cleaned) return cleaned
  }
  return "Here's a fresh outfit idea to explore!"
}

const extractStructuredReply = (payload: unknown): StructuredStylistReply | null => {
  const reply = normaliseStructuredReply(payload)
  if (!reply) return null
  const hasOutfit = Array.isArray(reply.outfits) && reply.outfits.some((outfit) => outfit.pieces && outfit.pieces.length > 0)
  const hasTips = Array.isArray(reply.tips) && reply.tips.length > 0
  if (reply.header || hasOutfit || hasTips || reply.followUp) {
    return reply
  }
  return null
}

const buildFallbackImagePrompt = (caption: string, structured: StructuredStylistReply | null, gender?: GenderTarget): string => {
  let focus = caption
  if (structured?.outfits && structured.outfits.length) {
    const lead = structured.outfits[0]
    const pieces = (lead.pieces ?? [])
      .map((piece) => {
        const color = piece.color ? piece.color.trim() : ''
        const descriptor = piece.description ?? piece.type
        const combined = color ? `${color} ${descriptor}` : descriptor
        return sanitizeLine(combined)
      })
      .filter(Boolean)
    if (pieces.length) {
      focus = pieces.join(', ')
    } else if (lead.summary) {
      focus = lead.summary
    }
  }
  const genderPhrase =
    gender === 'female'
      ? 'fashion portrait of a stylish woman'
      : gender === 'male'
        ? 'fashion portrait of a stylish man'
        : 'fashion portrait of a stylish person'
  return `${genderPhrase} wearing ${focus}. High-detail editorial photography, soft studio lighting, full-body shot, 8k resolution, vivid colors.`
}

const persistChatImage = async (
  arrayBuffer: ArrayBuffer,
  contentType: string,
  opts: { userId?: string | null } = {}
): Promise<string | null> => {
  try {
    const { bucket, folder } = getSupabaseStorageConfig()
    const client = createServiceClient()
    const extension = toExtension(contentType)
    const safeUser = opts.userId ? opts.userId.replace(/[^a-zA-Z0-9_-]/g, '') || 'user' : 'guest'
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`
    const storagePath = [folder, 'chat-renders', safeUser, fileName].filter(Boolean).join('/')
    const buffer = Buffer.from(arrayBuffer)
    const { error } = await client.storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType, cacheControl: '31536000', upsert: false })
    if (error) {
      console.error('Failed to upload chat image to storage:', error)
      return null
    }
    const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
    return data?.publicUrl ?? null
  } catch (error) {
    console.error('Failed to persist chat image:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  let resolvedDisplayName: string | undefined
  try {
    const json = await request.json()
    const parsed = PayloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const body = parsed.data
    resolvedDisplayName = body.userProfile?.displayName?.trim() || undefined
    const mode = body.mode ?? 'stylist'

    const targetGender = normalizeGender(body.userProfile?.gender)
    const shouldGenerateImage = mode !== 'assistant' && isOutfitRequest(body.message)
    const closetItems = Array.isArray(body.closetItems) ? body.closetItems : []
    const closetSummary = summariseClosetForPrompt(closetItems)
    const onlinePieces = await getOnlinePieces(targetGender, undefined)
    const onlineSummary = summarisePiecesForPrompt(onlinePieces, 12)

    const closetBlock = closetSummary.length
      ? `Closet Inventory (prioritise these pieces):
${closetSummary.join('\n')}`
      : 'Closet Inventory: No items provided.'

    const onlineBlock = onlineSummary.length
      ? `Online Store Highlights (mention the brand when you suggest one):
${onlineSummary.join('\n')}`
      : 'Online Store Highlights: None available.'

    const stylistSystemPrompt = `You are Echo Shop's friendly fashion stylist. Always respond with JSON exactly matching this structure (no extra prose):

${STRUCTURED_RESPONSE_SCHEMA}

Guidelines:
- Provide one or two outfit options at most. Each piece needs a clear garment type, a friendly colour name, and a concise descriptor. Include a hex code only when you are confident; otherwise omit it.
- Prioritise items from the user's closet. When you suggest an online or new purchase, mention the source or brand inside the description (e.g., "Online – Concrete: Navy trench coat").
- Spotlight favourite colours or styles and avoid any listed dislikes. Match the tone and aesthetic to the user's age, gender, and context.
- Keep "tips" to a maximum of three short, practical bullets.
- "followUp" must be an engaging question that invites the user to reply.
- Colour arrays (complementary/analogous/neutrals) must contain approachable colour names only—never theory jargon or raw hex codes.
- Make the header feel like a warm greeting that includes the user's name when available.`

    const stylistSystemPromptWithImage = `${stylistSystemPrompt}

When an inspirational image is useful, include these additional top-level fields alongside "structured":
- "caption": A one-sentence, friendly description suited for screen readers.
- "imagePrompt": A vivid, single-paragraph description for an AI image generator that references garments, colours, setting, lighting, and camera mood.`

    const assistantSystemPrompt = `You are the Echo Shop onboarding assistant. Be brief, encouraging, and always guide the user to specific features. Prioritise:
1. Explaining the four core features (Outfit Builder, Digital Closet, Color Analyzer, AI Chat).
2. Letting the user know how to replay the guided tour or open the floating assistant.
3. Providing actionable next steps (e.g., "Tap Add to Closet to upload your first item").
Remain friendly, use at most 6 short lines, and avoid deep fashion analysis.`

    const prompt = `User message: ${body.message}

${body.context ? `Context: ${body.context}` : ''}
${body.imageColors?.length ? `Image context: Dominant colors detected: ${body.imageColors.join(', ')}. If relevant, suggest color pairings and outfit ideas that complement these colors.` : ''}

User Profile:
- Name: ${body.userProfile?.displayName || 'not specified'}
- Gender: ${body.userProfile?.gender || 'not specified'}
- Age: ${body.userProfile?.age || 'not specified'}
- Favorite Colors: ${body.userProfile?.favoriteColors?.join(', ') || 'none specified'}
- Disliked Colors: ${body.userProfile?.dislikedColors?.join(', ') || 'none specified'}
- Favorite Styles: ${body.userProfile?.favoriteStyles?.join(', ') || 'none specified'}

${closetBlock}

${onlineBlock}

Please provide a helpful and personalised response that references these sources when giving outfit advice.`

    const systemPrompt = mode === 'assistant'
      ? assistantSystemPrompt
      : shouldGenerateImage
        ? stylistSystemPromptWithImage
        : stylistSystemPrompt

    const maxTokens = mode === 'assistant' ? 250 : 800
    const baseAiOptions = { temperature: 0.5, maxTokens }

    if (!shouldGenerateImage) {
      if (mode === 'assistant') {
        const reply = await callMistralAI(prompt, systemPrompt, baseAiOptions)
        return NextResponse.json({
          response: reply,
          reply,
          meta: { source: 'assistant' },
        })
      }

      const raw = await callMistralAI(prompt, systemPrompt, {
        ...baseAiOptions,
        responseFormat: { type: 'json_object' },
      })

      const structuredPayload = parseJsonBlock(raw)
      const container = structuredPayload && typeof structuredPayload === 'object' ? (structuredPayload as Record<string, unknown>) : {}
      let structuredReply = extractStructuredReply(container['structured'] ?? structuredPayload) ?? null

      if (!structuredReply) {
        console.warn('[stylist-chat] Structured reply missing, using fallback content.')
        structuredReply = buildErrorStructuredReply('I need a moment to polish these ideas—shall we try again right now?')
      }

      const formatted = renderStructuredReply(structuredReply, { userName: resolvedDisplayName })

      return NextResponse.json({
        response: formatted,
        reply: formatted,
        structured: structuredReply,
      })
    }

    const raw = await callMistralAI(prompt, systemPrompt, {
      ...baseAiOptions,
      responseFormat: { type: 'json_object' },
    })

    const structuredPayload = parseJsonBlock(raw)
    const container = structuredPayload && typeof structuredPayload === 'object' ? (structuredPayload as Record<string, unknown>) : {}
    let structuredReply = extractStructuredReply(container['structured'] ?? structuredPayload) ?? null

    if (!structuredReply) {
      console.warn('[stylist-chat] Structured reply missing for image mode, falling back to friendly template.')
      structuredReply = buildErrorStructuredReply('Here is a simple outfit direction while I refresh the visual preview.')
    }

    const formatted = renderStructuredReply(structuredReply, { userName: resolvedDisplayName })
    const caption = buildCaption(typeof container.caption === 'string' ? container.caption : undefined, structuredReply)
    const imagePromptSource =
      typeof container.imagePrompt === 'string' && container.imagePrompt.trim().length > 0
        ? container.imagePrompt.trim()
        : buildFallbackImagePrompt(caption, structuredReply, targetGender)

    try {
      const imageResult = await generateImageFromPrompt(imagePromptSource)
      const userId = await getAuthenticatedUserId().catch(() => null)
      const imageUrl = await persistChatImage(imageResult.arrayBuffer, imageResult.contentType, { userId })
      if (!imageUrl) {
        throw new Error('Image URL unavailable after upload')
      }

      return NextResponse.json({
        type: 'image',
        imageUrl,
        caption,
        text: formatted,
        response: formatted,
        reply: formatted,
        structured: structuredReply,
      })
    } catch (imageError) {
      console.error('Failed to generate or store outfit image:', imageError)
      return NextResponse.json({
        response: formatted,
        reply: formatted,
        structured: structuredReply,
        error: 'image_generation_failed',
      })
    }
  } catch (error) {
    console.error('Stylist chat error:', error)
    const fallbackStructured = buildErrorStructuredReply('I ran into an unexpected issue, but I can try again right away.')
    const fallback = renderStructuredReply(fallbackStructured, { userName: resolvedDisplayName })
    return NextResponse.json({ error: 'Failed to generate chat response', response: fallback, reply: fallback, structured: fallbackStructured }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stylist chat API is running' }, { status: 200 })
}

