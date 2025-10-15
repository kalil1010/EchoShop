import type { OutfitPieceRecommendation, OutfitSuggestionResponse } from '@/types/outfit'

export interface AvatarProfileDescriptor {
  gender?: string
  heightCm?: number
  weightKg?: number
  photoUrl?: string
  displayName?: string
}

export interface AvatarContextDescriptor {
  occasion?: string
  location?: string
  temperatureC?: number
  condition?: string
}

export interface AvatarPromptOptions {
  outfit: OutfitSuggestionResponse
  profile?: AvatarProfileDescriptor
  context?: AvatarContextDescriptor
  metadata?: Record<string, unknown>
}

const formatHeight = (heightCm?: number): string => {
  if (!heightCm || Number.isNaN(heightCm)) return 'average height (~170cm)'
  const cm = Math.round(heightCm)
  const totalInches = heightCm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return `${cm}cm (${feet}'${inches}")`
}

const formatWeight = (weightKg?: number): string => {
  if (!weightKg || Number.isNaN(weightKg)) return 'average build (~70kg)'
  const kg = Math.round(weightKg)
  const lbs = Math.round(weightKg * 2.20462)
  return `${kg}kg (${lbs}lbs)`
}

const describeGender = (gender?: string): string => {
  if (!gender) return 'androgynous'
  const value = gender.toLowerCase()
  if (value === 'male' || value === 'man') return 'male'
  if (value === 'female' || value === 'woman') return 'female'
  return value
}

const formatPiece = (label: string, piece?: OutfitPieceRecommendation) => {
  if (!piece) return null
  const details = [piece.summary]
  if (piece.color) {
    details.push(`Color: ${piece.color}`)
  }
  if (piece.source === 'online' && piece.sourceUrl) {
    details.push(`Source: ${piece.sourceUrl}`)
  } else if (piece.source === 'online') {
    details.push('Source: online recommendation')
  }
  return `- ${label}: ${details.join(' — ')}`
}

const buildContextBlock = (context?: AvatarContextDescriptor) => {
  if (!context) return null
  const parts: string[] = []
  if (context.occasion) parts.push(`Occasion: ${context.occasion}`)
  if (context.location) parts.push(`Location: ${context.location}`)
  if (typeof context.temperatureC === 'number') parts.push(`Temperature: ${context.temperatureC}°C`)
  if (context.condition) parts.push(`Weather: ${context.condition}`)
  if (!parts.length) return null
  return parts.join(', ')
}

export function buildAvatarPrompt(options: AvatarPromptOptions): string {
  const { outfit, profile, context } = options

  const gender = describeGender(profile?.gender)
  const height = formatHeight(profile?.heightCm)
  const weight = formatWeight(profile?.weightKg)

  const subjectDescription = `Generate a realistic full-body studio portrait of a ${gender} adult with ${height} height and ${weight} body build.`

  const outfitLines: string[] = []
  const topLine = formatPiece('Top', outfit.top)
  const bottomLine = formatPiece('Bottom', outfit.bottom)
  const footwearLine = formatPiece('Footwear', outfit.footwear)
  const outerwearLine = formatPiece('Outerwear', outfit.outerwear)

  if (topLine) outfitLines.push(topLine)
  if (bottomLine) outfitLines.push(bottomLine)
  if (footwearLine) outfitLines.push(footwearLine)
  if (outerwearLine) outfitLines.push(outerwearLine)

  if (Array.isArray(outfit.accessories) && outfit.accessories.length > 0) {
    outfit.accessories
      .map((item, index) => formatPiece(`Accessory ${outfit.accessories.length > 1 ? index + 1 : ''}`.trim(), item))
      .filter((line): line is string => Boolean(line))
      .forEach((line) => outfitLines.push(line))
  }

  if (!outfitLines.length) {
    outfitLines.push('- Outfit: Use the best judgment based on provided context (no explicit items supplied).')
  }

  const instructions: string[] = []

  if (profile?.photoUrl) {
    instructions.push(
      `Reference face image: ${profile.photoUrl}. If direct image blending is unsupported, approximate facial structure and expression based on this reference.`
    )
  } else {
    instructions.push('Face: natural expression, light makeup, well-groomed hair.')
  }

  const contextLine = buildContextBlock(context)
  if (contextLine) {
    instructions.push(`Context: ${contextLine}.`)
  }

  if (outfit.styleNotes) {
    instructions.push(`Style notes to respect: ${outfit.styleNotes}`)
  }

  instructions.push('Camera: 35mm lens look, sharp focus, soft diffused lighting.')
  instructions.push('Background: plain light neutral backdrop, slight studio gradient.')
  instructions.push('Output: photorealistic, high-resolution (1024x1024 or higher), full body visible head-to-toe.')

  return [
    subjectDescription,
    '',
    'Outfit details:',
    ...outfitLines,
    '',
    'Instructions:',
    ...instructions,
  ].join('\n')
}
