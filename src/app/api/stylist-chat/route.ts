import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { summariseClosetForPrompt } from '@/lib/closet'
import { getOnlinePieces, summarisePiecesForPrompt } from '@/lib/fashionPieces'
import { callMistralAI } from '@/lib/genkit'
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

When asked for an outfit, use the user's closet items first. Only reference the online store highlights when the closet lacks a needed piece or when suggesting an optional purchase—make it clear when something is a shopping idea.

When asked for an outfit, return exactly these sections (omit any that don’t apply):

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
3. Providing actionable next steps (e.g., “Tap Add to Closet to upload your first item”).
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

    const systemPrompt = mode === 'assistant' ? assistantSystemPrompt : stylistSystemPrompt
    const maxTokens = mode === 'assistant' ? 250 : 600

    const reply = await callMistralAI(prompt, systemPrompt, { temperature: 0.5, maxTokens })

    return NextResponse.json({
      response: reply,
      reply,
      meta: mode === 'assistant' ? { source: 'assistant' } : undefined,
    })
  } catch (error) {
    console.error('Stylist chat error:', error)
    return NextResponse.json({ error: 'Failed to generate chat response' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Stylist chat API is running' }, { status: 200 })
}
