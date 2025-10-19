import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'

import { analyzeGarmentWithMistral } from '@/lib/mistralVision'
import { buildPersonalizedColorAdvice, type UserStyleProfile, type ColorSwatch } from '@/lib/personalizedColors'

type AnalyzeImageRequest = {
  dataUrl?: string
  profile?: UserStyleProfile
}

const parseDataUrl = (dataUrl?: string): { buffer: Buffer; mimeType: string } | null => {
  if (!dataUrl) return null
  const match = dataUrl.match(/^data:(?<mime>[^;]+);base64,(?<data>.+)$/)
  if (!match?.groups?.data || !match.groups.mime) {
    return null
  }
  try {
    const buffer = Buffer.from(match.groups.data, 'base64')
    return { buffer, mimeType: match.groups.mime }
  } catch (error) {
    console.warn('[analyze-image] Failed to parse data URL', error)
    return null
  }
}

const normaliseGarmentType = (value?: string | null): string | undefined => {
  if (!value) return undefined
  const token = value.toLowerCase()
  if (token.includes('foot') || token.includes('shoe')) return 'footwear'
  if (token.includes('pant') || token.includes('skirt') || token.includes('short')) return 'bottom'
  if (token.includes('dress')) return 'dress'
  if (token.includes('outer') || token.includes('jacket') || token.includes('coat')) return 'outer layer'
  if (token.includes('accessory') || token.includes('bag') || token.includes('belt') || token.includes('hat')) return 'accessory'
  return 'top'
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeImageRequest
    const parsed = parseDataUrl(body.dataUrl)

    if (!parsed) {
      return NextResponse.json({ error: 'Missing or invalid image data' }, { status: 400 })
    }

    const analysis = await analyzeGarmentWithMistral(parsed.buffer, parsed.mimeType)
    if (!analysis) {
      return NextResponse.json(
        { error: 'Vision analysis failed', details: 'We could not read colors from that image. Please try another photo.' },
        { status: 502 },
      )
    }

    const colors: ColorSwatch[] = Array.isArray(analysis.colors)
      ? analysis.colors.map((color) => ({
          name: color.name,
          hex: color.hex,
        }))
      : []

    const advice = buildPersonalizedColorAdvice(colors, analysis.suggestedType, body.profile)

    return NextResponse.json({
      description: analysis.description,
      garmentType: normaliseGarmentType(analysis.suggestedType),
      colors,
      advice,
      safety: analysis.safety,
    })
  } catch (error) {
    console.error('[analyze-image] Unexpected failure', error)
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: 'Analyze failed', details }, { status: 500 })
  }
}
