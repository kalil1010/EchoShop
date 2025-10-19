import { getMatchingColors, getRichPalette, getColorName } from '@/lib/imageAnalysis'

export type ColorSwatch = { name: string; hex: string }

export interface UserStyleProfile {
  age?: number
  gender?: string
  favoriteColors?: string[]
  dislikedColors?: string[]
  stylePreferences?: string[]
}

export interface ColorPairing {
  key: 'contrast' | 'harmony' | 'neutral'
  title: string
  colors: ColorSwatch[]
  rationale: string
  highlight?: string
}

export interface ColorAdvice {
  baseColor: ColorSwatch | null
  summary: string
  pairings: ColorPairing[]
}

const ensureHex = (hex: string): string => {
  const trimmed = hex.trim()
  if (!trimmed) return '#000000'
  return trimmed.startsWith('#') ? trimmed.toUpperCase() : `#${trimmed.toUpperCase()}`
}

const toNamedSwatch = (hex: string, fallbackName?: string): ColorSwatch => {
  const normalised = ensureHex(hex)
  const name = getColorName(normalised)
  return {
    hex: normalised,
    name: fallbackName?.trim() || name,
  }
}

const normaliseToken = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

const buildSet = (values?: string[]): Set<string> => {
  const set = new Set<string>()
  values?.forEach((value) => {
    const token = normaliseToken(value)
    if (!token) return
    set.add(token)
    if (token.startsWith('#') && token.length === 7) {
      set.add(token.toUpperCase())
    }
  })
  return set
}

type ToneWord = 'playful' | 'fresh' | 'polished' | 'refined'

const pickToneWord = (age?: number): ToneWord => {
  if (typeof age !== 'number' || Number.isNaN(age)) return 'fresh'
  if (age < 21) return 'playful'
  if (age < 34) return 'fresh'
  if (age < 50) return 'polished'
  return 'refined'
}

const styleDescriptors: Record<string, string> = {
  streetwear: 'streetwear',
  sporty: 'sporty',
  athleisure: 'sporty',
  minimal: 'minimal',
  minimalist: 'minimal',
  classic: 'classic',
  business: 'tailored',
  formal: 'tailored',
  preppy: 'polished',
  edgy: 'edgy',
  casual: 'casual',
  boho: 'boho',
  elegant: 'elegant',
}

const mapStyleDescriptor = (styles?: string[]): string | null => {
  if (!styles?.length) return null
  for (const style of styles) {
    const token = normaliseToken(style)
    if (!token) continue
    const descriptor = styleDescriptors[token]
    if (descriptor) {
      return descriptor
    }
  }
  return null
}

const formatList = (values: string[]): string => {
  if (!values.length) return ''
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} or ${values[1]}`
  const [head, ...rest] = values
  if (!rest.length) return head
  const last = rest[rest.length - 1]
  const middle = rest.slice(0, -1).join(', ')
  if (!middle) return `${head}, or ${last}`
  return `${head}, ${middle}, or ${last}`
}

const buildRationale = (
  key: ColorPairing['key'],
  tone: ToneWord,
  styleDescriptor: string | null,
  gender: string | undefined,
  highlight?: string,
): string => {
  const base = (() => {
    switch (key) {
      case 'contrast':
        if (tone === 'playful') return 'for a bold pop'
        if (tone === 'fresh') return 'for a crisp contrast'
        if (tone === 'polished') return 'for a classic contrast'
        return 'for a refined contrast'
      case 'harmony':
        if (tone === 'playful') return 'to keep things soft and coordinated'
        if (tone === 'fresh') return 'to keep things easy and cohesive'
        if (tone === 'polished') return 'to keep the palette elegant'
        return 'to maintain a soft, composed mix'
      case 'neutral':
      default:
        if (tone === 'playful') return 'for an effortless base'
        if (tone === 'fresh') return 'for a versatile everyday base'
        if (tone === 'polished') return 'for a timeless base'
        return 'for a grounded, refined base'
    }
  })()

  const styleNote = styleDescriptor ? ` that leans ${styleDescriptor}` : ''
  const token = normaliseToken(gender)
  const genderNote = (() => {
    if (!token) return ''
    if (token.startsWith('fem') || token === 'woman') {
      if (key === 'contrast') return ' while keeping it softly feminine'
      if (key === 'harmony') return ' with a graceful ease'
      return ' with a feminine, polished finish'
    }
    if (token.startsWith('mal') || token === 'man') {
      if (key === 'contrast') return ' while keeping it sharp'
      if (key === 'harmony') return ' with a clean, modern edge'
      return ' with a grounded, confident feel'
    }
    if (token.includes('non') || token.includes('other')) {
      return ' with an inclusive, relaxed vibe'
    }
    return ''
  })()
  const favouriteNote = highlight ? ` since it's one of your favorites` : ''

  return `${base}${styleNote}${genderNote}${favouriteNote}.`
}

const pairingTitleMap: Record<ColorPairing['key'], string> = {
  contrast: 'Bold Contrast',
  harmony: 'Soft Harmony',
  neutral: 'Easy Neutral',
}

type Candidate = {
  key: ColorPairing['key']
  colors: ColorSwatch[]
  score: number
  highlight?: string
}

const filterDistinct = (swatches: ColorSwatch[]): ColorSwatch[] => {
  const seen = new Set<string>()
  const result: ColorSwatch[] = []
  for (const swatch of swatches) {
    const key = `${swatch.name.toLowerCase()}|${swatch.hex.toUpperCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(swatch)
  }
  return result
}

const normaliseGarmentType = (value?: string | null): string | null => {
  if (!value) return null
  const token = value.toLowerCase()
  if (token.includes('top')) return 'top'
  if (token.includes('bottom') || token.includes('pant') || token.includes('short') || token.includes('skirt')) return 'bottom'
  if (token.includes('outer') || token.includes('jacket') || token.includes('coat')) return 'outer layer'
  if (token.includes('foot') || token.includes('shoe') || token.includes('boot')) return 'footwear'
  if (token.includes('dress')) return 'dress'
  if (token.includes('bag') || token.includes('belt') || token.includes('hat') || token.includes('accessory')) return 'accessory'
  return value
}

export function buildPersonalizedColorAdvice(
  colors: ColorSwatch[] | undefined,
  garmentType?: string | null,
  profile?: UserStyleProfile,
): ColorAdvice {
  const baseColor = colors?.length ? colors[0] : null
  const tone = pickToneWord(profile?.age)
  const styleDescriptor = mapStyleDescriptor(profile?.stylePreferences ?? profile?.favoriteStyles)
  const favoriteNames = buildSet(profile?.favoriteColors)
  const dislikedNames = buildSet(profile?.dislikedColors)

  const baseHex = baseColor ? ensureHex(baseColor.hex) : null
  const matches = baseHex ? getMatchingColors(baseHex) : null
  const richPalette = baseHex ? getRichPalette(baseHex) : null

  const baseSwatch = baseColor ? { name: baseColor.name, hex: ensureHex(baseColor.hex) } : null

  const candidates: Candidate[] = []

  const isAllowed = (swatch: ColorSwatch): boolean => {
    const nameToken = normaliseToken(swatch.name)
    const hexToken = ensureHex(swatch.hex)
    if (nameToken && dislikedNames.has(nameToken)) return false
    if (dislikedNames.has(hexToken.toLowerCase()) || dislikedNames.has(hexToken)) return false
    return true
  }

  const ensureHighlight = (swatch: ColorSwatch): string | undefined => {
    const token = normaliseToken(swatch.name)
    if (!token) return undefined
    if (favoriteNames.has(token) || favoriteNames.has(ensureHex(swatch.hex))) {
      return swatch.name.toLowerCase()
    }
    return undefined
  }

  if (baseSwatch && matches?.complementary) {
    const accent = toNamedSwatch(matches.complementary)
    if (isAllowed(accent)) {
      const highlight = ensureHighlight(accent)
      let score = 8
      if (highlight) score += 3
      if (styleDescriptor === 'streetwear' || styleDescriptor === 'edgy') score += 1
      candidates.push({
        key: 'contrast',
        colors: filterDistinct([baseSwatch, accent]),
        score,
        highlight,
      })
    }
  }

  if (baseSwatch && matches?.analogous?.length) {
    const analogousAccents = matches.analogous.slice(0, 2).map((hex) => toNamedSwatch(hex))
    const allowed = analogousAccents.filter(isAllowed)
    if (allowed.length) {
      const highlight = allowed.map(ensureHighlight).find(Boolean)
      let score = 6 + allowed.length
      if (highlight) score += 2
      if (styleDescriptor === 'minimal' || styleDescriptor === 'classic') score += 1
      const colorsForPairing = filterDistinct([baseSwatch, allowed[0]])
      candidates.push({
        key: 'harmony',
        colors: colorsForPairing,
        score,
        highlight,
      })
    }
  }

  if (baseSwatch && richPalette?.neutrals?.length) {
    const neutralAccents = richPalette.neutrals
      .map((hex) => toNamedSwatch(hex))
      .filter((swatch) => normaliseToken(swatch.name) !== normaliseToken(baseSwatch.name))
      .filter(isAllowed)
      .slice(0, 2)
    if (neutralAccents.length) {
      const highlight = neutralAccents.map(ensureHighlight).find(Boolean)
      let score = 5
      if (highlight) score += 1
      if (styleDescriptor === 'tailored' || styleDescriptor === 'classic' || styleDescriptor === 'elegant') {
        score += 1
      }
      candidates.push({
        key: 'neutral',
        colors: filterDistinct([baseSwatch, neutralAccents[0]]),
        score,
        highlight,
      })
    }
  }

  const sorted = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  const pairings: ColorPairing[] = sorted.map((candidate) => {
    const rationale = buildRationale(candidate.key, tone, styleDescriptor, profile?.gender, candidate.highlight)
    return {
      key: candidate.key,
      title: pairingTitleMap[candidate.key],
      colors: candidate.colors,
      rationale,
      highlight: candidate.highlight,
    }
  })

  const garmentPhrase = (() => {
    const mapped = normaliseGarmentType(garmentType)
    if (!mapped) return 'this piece'
    if (/^[aeiou]/i.test(mapped)) return `this ${mapped}`
    return `this ${mapped}`
  })()

  const summary = (() => {
    if (!pairings.length) {
      if (baseSwatch) {
        return `Lean into warm neutrals or soft charcoal with ${garmentPhrase} to keep the look balanced and easy to wear.`
      }
      return 'Try pairing this piece with easy neutrals like soft beige or charcoal to keep the look effortless.'
    }

    const buildSentence = (pairing: ColorPairing, prefix: 'Try' | 'Or'): string => {
      const accentNames = pairing.colors
        .slice(1)
        .map((swatch) => swatch.name.toLowerCase())
      const accentList = formatList(accentNames)
      const rationale = pairing.rationale ? pairing.rationale.replace(/\.*$/, '') : ''
      const highlightNote = pairing.highlight ? ` It also taps into your love of ${pairing.highlight}.` : ''
      const sentence = `${prefix} pairing ${garmentPhrase} with ${accentList} ${rationale.toLowerCase()}`
      return `${sentence.trim()}.${highlightNote}`
    }

    if (pairings.length === 1) {
      return buildSentence(pairings[0], 'Try')
    }
    const first = buildSentence(pairings[0], 'Try')
    const second = buildSentence(pairings[1], 'Or')
    return `${first} ${second}`
  })()

  return {
    baseColor: baseSwatch,
    summary,
    pairings,
  }
}
