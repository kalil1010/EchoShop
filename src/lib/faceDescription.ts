const SIGHTENGINE_ENDPOINT = 'https://api.sightengine.com/1.0/check.json'
const FACE_MODELS = 'face-attributes,face-expression,face-gender'
const DEFAULT_SIGHTENGINE_USER = '1244056913'
const DEFAULT_SIGHTENGINE_SECRET = 'DS4wrd3ujeein2N3s5qbYog8rketceYk'

type ProbabilityRecord = Record<string, unknown>

const pickTopEntry = (input: unknown): { key: string; score: number } | null => {
  if (!input || typeof input !== 'object') return null
  let bestKey = ''
  let bestScore = 0

  for (const [key, value] of Object.entries(input as ProbabilityRecord)) {
    let score: number | null = null
    if (typeof value === 'number') {
      score = value
    } else if (value && typeof value === 'object') {
      const candidate = value as Record<string, unknown>
      if (typeof candidate.prob === 'number') score = candidate.prob
      else if (typeof candidate.probability === 'number') score = candidate.probability
      else if (typeof candidate.value === 'number') score = candidate.value
      else if (typeof candidate.score === 'number') score = candidate.score
    }

    if (typeof score === 'number' && score > bestScore) {
      bestKey = key
      bestScore = score
    }
  }

  return bestScore > 0 ? { key: bestKey, score: bestScore } : null
}

const normaliseKey = (key: string): string => key.replace(/_/g, ' ').replace(/-/g, ' ').trim()

const capitalise = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

const mapGender = (key: string): string => {
  const lowered = key.toLowerCase()
  if (lowered === 'male' || lowered === 'man') return 'masculine-presenting'
  if (lowered === 'female' || lowered === 'woman') return 'feminine-presenting'
  return lowered
}

const mapSkinTone = (key: string): string => {
  const lowered = key.toLowerCase()
  const lookup: Record<string, string> = {
    very_light: 'very light',
    light: 'light',
    medium_light: 'medium light',
    medium: 'medium',
    medium_dark: 'medium dark',
    dark: 'dark',
    very_dark: 'very dark',
    brown: 'brown',
    dark_brown: 'dark brown',
  }
  return lookup[lowered] ?? normaliseKey(lowered)
}

const mapHairLength = (key: string): string => {
  const lowered = key.toLowerCase()
  const lookup: Record<string, string> = {
    short: 'short',
    medium: 'medium-length',
    long: 'long',
    very_short: 'very short',
    very_long: 'very long',
    shaved: 'shaved',
    bald: 'bald',
  }
  return lookup[lowered] ?? normaliseKey(lowered)
}

const mapFacialHair = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') return null
  const values: Array<{ label: string; score: number }> = []
  for (const [key, value] of Object.entries(input as ProbabilityRecord)) {
    if (typeof value === 'number' && value > 0.35) {
      values.push({ label: key, score: value })
    } else if (value && typeof value === 'object') {
      const candidate = value as Record<string, unknown>
      const score =
        typeof candidate.prob === 'number'
          ? candidate.prob
          : typeof candidate.value === 'number'
            ? candidate.value
            : typeof candidate.score === 'number'
              ? candidate.score
              : null
      if (score && score > 0.35) {
        values.push({ label: key, score })
      }
    }
  }

  if (!values.length) return null
  values.sort((a, b) => b.score - a.score)
  const phrases = values
    .slice(0, 2)
    .map((entry) => normaliseKey(entry.label))
    .map((label) => (label === 'none' ? null : label))
    .filter((label): label is string => Boolean(label))

  if (!phrases.length) return null
  return phrases.join(' and ')
}

const extractAge = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Record<string, unknown>
  const min = typeof candidate.min === 'number' ? candidate.min : undefined
  const max = typeof candidate.max === 'number' ? candidate.max : undefined
  const mean = typeof candidate.mean === 'number' ? candidate.mean : undefined

  const midpoint =
    typeof mean === 'number'
      ? mean
      : typeof min === 'number' && typeof max === 'number'
        ? (min + max) / 2
        : typeof min === 'number'
          ? min
          : typeof max === 'number'
            ? max
            : null

  if (!midpoint) return null
  const rounded = Math.round(midpoint / 5) * 5
  return `approximately ${rounded} years old`
}

const decodeGlasses = (input: unknown): string | null => {
  if (!input || typeof input !== 'object') return null
  const candidate = input as Record<string, unknown>
  const wearing =
    typeof candidate.value === 'string'
      ? candidate.value
      : typeof candidate.category === 'string'
        ? candidate.category
        : null
  if (!wearing) {
    const top = pickTopEntry(candidate)
    if (top && top.score > 0.45 && top.key !== 'no_glasses' && top.key !== 'none') {
      return `${normaliseKey(top.key)} glasses`
    }
    return null
  }
  const lowered = wearing.toLowerCase()
  if (lowered === 'no' || lowered === 'none' || lowered === 'no_glasses') return null
  return `${normaliseKey(lowered)} glasses`
}

const extractExpression = (input: unknown): string | null => {
  const top = pickTopEntry(input)
  if (!top || top.score < 0.3) return null
  return normaliseKey(top.key)
}

const buildDescriptor = (face: Record<string, unknown>): string | null => {
  const attributes = (face.attributes as Record<string, unknown> | undefined) ?? {}

  const genderKey =
    pickTopEntry(attributes.gender) ??
    pickTopEntry(attributes.sex) ??
    pickTopEntry(attributes.gender_estimation)
  const gender = genderKey ? mapGender(genderKey.key) : null

  const age = extractAge(attributes.age)

  const skinKey = pickTopEntry(attributes.skin ?? attributes.skin_tone ?? attributes.complexion)
  const skin = skinKey ? `${mapSkinTone(skinKey.key)} skin tone` : null

  const hairBlock = (attributes.hair as Record<string, unknown> | undefined) ?? {}
  const hairColorKey = pickTopEntry(hairBlock.color)
  const hairLengthKey = pickTopEntry(hairBlock.length)
  const hairStyleKey = pickTopEntry(hairBlock.style)

  const hairParts: string[] = []
  if (hairColorKey && hairColorKey.score > 0.25) {
    hairParts.push(`${normaliseKey(hairColorKey.key)} hair`)
  }
  if (hairLengthKey && hairLengthKey.score > 0.25) {
    hairParts.push(mapHairLength(hairLengthKey.key))
  }
  if (hairStyleKey && hairStyleKey.score > 0.25 && hairStyleKey.key !== hairLengthKey?.key) {
    hairParts.push(normaliseKey(hairStyleKey.key))
  }
  const hair = hairParts.length ? hairParts.join(' ') : null

  const facialHair = mapFacialHair(attributes.facial_hair ?? attributes.beard)
  const glasses = decodeGlasses(attributes.glasses)
  const expression = extractExpression(attributes.expression ?? attributes.emotion ?? attributes.mood)

  const traits = [
    gender,
    age,
    skin,
    hair ? hair.replace(/\s+/g, ' ').trim() : null,
    facialHair ? `${facialHair}` : null,
    glasses,
  ].filter((part): part is string => Boolean(part))

  const sentences: string[] = []
  if (traits.length) {
    sentences.push(traits.join(', '))
  }
  if (expression) {
    sentences.push(`expression: ${expression}`)
  }

  if (!sentences.length) return null
  return sentences.join('. ')
}

export async function describeFaceFromImage(imageUrl: string): Promise<string | null> {
  const apiUser = process.env.SIGHTENGINE_API_USER || DEFAULT_SIGHTENGINE_USER
  const apiSecret = process.env.SIGHTENGINE_API_SECRET || DEFAULT_SIGHTENGINE_SECRET

  if (!apiUser || !apiSecret) {
    return null
  }

  try {
    const params = new URLSearchParams({
      models: FACE_MODELS,
      api_user: apiUser,
      api_secret: apiSecret,
      url: imageUrl,
    })

    const response = await fetch(`${SIGHTENGINE_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      console.warn('[face-description] sightengine fetch failed', {
        status: response.status,
        statusText: response.statusText,
      })
      return null
    }

    const payload = (await response.json()) as Record<string, unknown>
    const status = typeof payload.status === 'string' ? payload.status : ''
    if (status === 'failure') {
      console.warn('[face-description] sightengine reported failure', payload)
      return null
    }
    const faces = Array.isArray(payload.faces) ? payload.faces : []
    if (!faces.length) {
      return null
    }

    const firstFace = faces[0]
    if (!firstFace || typeof firstFace !== 'object') {
      return null
    }

    const descriptor = buildDescriptor(firstFace as Record<string, unknown>)
    if (!descriptor) return null

    return descriptor.length > 320 ? `${descriptor.slice(0, 317)}...` : descriptor
  } catch (error) {
    console.warn('[face-description] failed to derive traits', error)
    return null
  }
}
