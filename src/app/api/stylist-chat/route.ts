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
      gender: z.string().optional(),
      age: z.number().optional(),
      favoriteColors: z.array(z.string()).optional(),
      favoriteStyles: z.array(z.string()).optional(),
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

const buildCaption = (candidate?: string, markdown?: string): string => {
  const safeCandidate = candidate?.trim()
  if (safeCandidate) return safeCandidate
  if (markdown) {
    const lines = markdown
      .split(/\r?\n/)
      .map((line) => sanitizeLine(line))
      .filter(Boolean)
    if (lines.length) {
      return `Here's an outfit idea: ${lines[0]}`
    }
  }
  return "Here's a fresh outfit idea to explore!"
}

const extractOutfitDescription = (markdown?: string): string => {
  if (!markdown) return ''
  const lines = markdown.split(/\r?\n/)
  const details: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^-\s*(top|bottom|footwear|shoes?|outerwear|accessor)/i.test(trimmed)) {
      details.push(sanitizeLine(trimmed))
    } else if (/Top:\s/i.test(trimmed) || /Bottom:\s/i.test(trimmed) || /Shoes?:\s/i.test(trimmed) || /Accessories?:\s/i.test(trimmed)) {
      details.push(trimmed.replace(/^[*-]\s*/, ''))
    }
  }
  return details.length ? details.join(', ') : ''
}

const buildFallbackImagePrompt = (caption: string, markdown: string | undefined, gender?: GenderTarget): string => {
  const focus = extractOutfitDescription(markdown) || caption
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
  try {
    const json = await request.json()
    const parsed = PayloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const body = parsed.data
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

    const stylistSystemPrompt = `You are a friendly fashion stylist AI in Concise Mode. Keep answers short, clear, and enjoyable to read.

Formatting rules (strict):
- Use simple Markdown only (no tables).
- Max 8-12 lines total.
- Short bullets, no long paragraphs.
- End with one short follow-up question.

When asked for an outfit, use the user's closet items first. Only reference the online store highlights when the closet lacks a needed piece or when suggesting an optional purchase-make it clear when something is a shopping idea.

When asked for an outfit, return exactly these sections (omit any that don't apply):

## Outfit (1-2 options)
- Top: ...  Bottom: ...  Shoes: ...  Accessories: ...

## Colors
- Complementary: ...
- Analogous: ...
- Neutrals: ...

## Tips
- 1-2 quick pointers (fit/fabric/occasion).

Personalize to the user's profile and any provided image colors. Be helpful and upbeat, but never verbose.`

    const assistantSystemPrompt = `You are the ZMODA AI onboarding assistant. Be brief, encouraging, and always guide the user to specific features. Prioritise:
1. Explaining the four core features (Outfit Builder, Digital Closet, Color Analyzer, AI Chat).
2. Letting the user know how to replay the guided tour or open the floating assistant.
3. Providing actionable next steps (e.g., "Tap Add to Closet to upload your first item").
Remain friendly, use at most 6 short lines, and avoid deep fashion analysis.`

    const prompt = `User message: ${body.message}

${body.context ? `Context: ${body.context}` : ''}
${body.imageColors?.length ? `Image context: Dominant colors detected: ${body.imageColors.join(', ')}. If relevant, suggest color pairings and outfit ideas that complement these colors.` : ''}

User Profile:
- Gender: ${body.userProfile?.gender || 'not specified'}
- Age: ${body.userProfile?.age || 'not specified'}
- Favorite Colors: ${body.userProfile?.favoriteColors?.join(', ') || 'none specified'}
- Favorite Styles: ${body.userProfile?.favoriteStyles?.join(', ') || 'none specified'}

${closetBlock}

${onlineBlock}

Please provide a helpful and personalised response that references these sources when giving outfit advice.`

    const systemPrompt = mode === 'assistant'
      ? assistantSystemPrompt
      : shouldGenerateImage
        ? `${stylistSystemPrompt}

Additional instructions:
- Return only JSON with the shape {"markdown": string, "caption": string, "imagePrompt": string}.
- "markdown" must follow the formatting rules above and include the detailed outfit response.
- "caption" should be 1-2 friendly sentences that describe the visual outfit clearly for accessibility.
- "imagePrompt" should be a vivid, single-paragraph description tailored for an AI image generator (include garments, colours, gender cues, setting, camera framing).
- Do not include Markdown fences or any text outside the JSON object.`
        : stylistSystemPrompt

    const maxTokens = mode === 'assistant' ? 250 : 800

    if (!shouldGenerateImage) {
      const reply = await callMistralAI(prompt, systemPrompt, { temperature: 0.5, maxTokens })

      return NextResponse.json({
        response: reply,
        reply,
        meta: mode === 'assistant' ? { source: 'assistant' } : undefined,
      })
    }

    const raw = await callMistralAI(prompt, systemPrompt, {
      temperature: 0.5,
      maxTokens,
      responseFormat: { type: 'json_object' },
    })

    const structured = parseJsonBlock(raw)

    if (!structured || typeof structured !== 'object') {
      console.warn('Failed to parse structured stylist response, falling back to text mode')
      const fallbackReply = await callMistralAI(prompt, stylistSystemPrompt, { temperature: 0.5, maxTokens: 600 })
      return NextResponse.json({
        response: fallbackReply,
        reply: fallbackReply,
      })
    }

    const structuredData = structured as Record<string, unknown>
    const markdownValue = structuredData['markdown']
    const markdown = typeof markdownValue === 'string' ? markdownValue.trim() : ''
    const captionValue = structuredData['caption']
    const caption = buildCaption(
      typeof captionValue === 'string' ? captionValue : undefined,
      markdown
    )
    const imagePromptValue = structuredData['imagePrompt']
    const imagePromptSource =
      typeof imagePromptValue === 'string' && imagePromptValue.trim().length > 0
        ? imagePromptValue.trim()
        : buildFallbackImagePrompt(caption, markdown, targetGender)

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
        text: markdown,
        response: markdown,
        reply: markdown,
      })
    } catch (imageError) {
      console.error('Failed to generate or store outfit image:', imageError)
      const fallbackText = markdown || 'I pulled together an outfit idea, but generating the image failed. Please retry in a moment.'
      return NextResponse.json({
        response: fallbackText,
        reply: fallbackText,
        error: 'image_generation_failed',
      })
    }
  } catch (error) {
    console.error('Stylist chat error:', error)
    return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stylist chat API is running' }, { status: 200 })
}

