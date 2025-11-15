import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { analyzeGarmentWithMistral, describeClothingFromImage } from '@/lib/mistralVision'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

interface SuggestionRequest {
  imageUrl?: string
  imageBuffer?: string // base64
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const payload = (await request.json()) as SuggestionRequest

    if (!payload.imageUrl && !payload.imageBuffer) {
      return NextResponse.json({ error: 'Image URL or buffer required.' }, { status: 400 })
    }

    let imageUrl = payload.imageUrl
    let imageBuffer: Buffer | null = null

    // If base64 buffer provided, convert to data URL
    if (payload.imageBuffer && !imageUrl) {
      imageUrl = `data:image/jpeg;base64,${payload.imageBuffer}`
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Invalid image data.' }, { status: 400 })
    }

    // Analyze the image with Mistral
    let analysis = null
    if (imageUrl.startsWith('data:')) {
      // Parse data URL to buffer
      const base64Data = imageUrl.split(',')[1]
      if (base64Data) {
        imageBuffer = Buffer.from(base64Data, 'base64')
        analysis = await analyzeGarmentWithMistral(imageBuffer, 'image/jpeg')
      }
    } else {
      // Use URL directly
      const description = await describeClothingFromImage(imageUrl)
      if (description) {
        // For URL-based images, we'll use the description to generate suggestions
        // and try to get colors from a separate analysis if possible
        analysis = {
          description,
          colors: [],
          suggestedType: undefined,
          safety: { status: 'ok' as const, reasons: [] },
        }
      }
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'Failed to analyze image. Please try another image.' },
        { status: 502 },
      )
    }

    // Generate title from description
    const title = generateTitleFromDescription(analysis.description)

    // Generate tags from analysis
    const tags = generateTags(analysis.description, analysis.suggestedType, analysis.colors)

    return NextResponse.json({
      title,
      description: analysis.description,
      tags,
      colors: analysis.colors,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to generate suggestions.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function generateTitleFromDescription(description: string): string {
  // Extract key features from description to create a concise title
  const words = description.toLowerCase().split(/\s+/)
  const keyWords: string[] = []
  const skipWords = new Set(['a', 'an', 'the', 'with', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of'])

  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9]/g, '')
    if (cleaned.length > 3 && !skipWords.has(cleaned)) {
      keyWords.push(word)
      if (keyWords.length >= 5) break
    }
  }

  // Capitalize first letter of each word
  const title = keyWords
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return title || 'Fashion Item'
}

function generateTags(description: string, garmentType?: string, colors?: Array<{ name: string; hex: string }>): string[] {
  const tags: string[] = []

  // Add garment type
  if (garmentType) {
    tags.push(garmentType)
  }

  // Add color names
  if (colors && colors.length > 0) {
    colors.forEach((color) => {
      const colorName = color.name.toLowerCase()
      if (!tags.includes(colorName)) {
        tags.push(colorName)
      }
    })
  }

  // Extract style keywords from description
  const styleKeywords = [
    'casual',
    'formal',
    'elegant',
    'vintage',
    'modern',
    'classic',
    'trendy',
    'minimalist',
    'bohemian',
    'streetwear',
    'athletic',
    'luxury',
    'sustainable',
    'organic',
    'cotton',
    'linen',
    'silk',
    'wool',
    'denim',
    'leather',
  ]

  const descLower = description.toLowerCase()
  styleKeywords.forEach((keyword) => {
    if (descLower.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword)
    }
  })

  // Extract pattern/material keywords
  const patternKeywords = ['striped', 'polka', 'floral', 'geometric', 'solid', 'printed', 'embroidered']
  patternKeywords.forEach((keyword) => {
    if (descLower.includes(keyword) && !tags.includes(keyword)) {
      tags.push(keyword)
    }
  })

  return tags.slice(0, 10) // Limit to 10 tags
}

