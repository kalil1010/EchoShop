import axios, { type AxiosError } from 'axios'
import FormData from 'form-data'

const MODELS = 'nudity-2.1,weapon,type,gore-2.0,violence'

type BlockResult = {
  message: string
  category: string
  reasons: string[]
}

type Evaluation = BlockResult | null

type SightenginePayload = {
  status?: string
  nudity?: Record<string, unknown>
  gore?: unknown
  violence?: unknown
  weapon?: unknown
  [key: string]: unknown
}

const getProb = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    const prob = candidate.prob ?? candidate.probability ?? candidate.value
    if (typeof prob === 'number') return prob
  }
  return 0
}

const evaluateModeration = (data: SightenginePayload): Evaluation => {
  const triggered: Array<{ label: string; prob: number; message: string; category: string }> = []

  const addTrigger = (
    condition: boolean,
    label: string,
    prob: number,
    message: string,
    category: string,
  ) => {
    if (condition) {
      triggered.push({ label, prob, message, category })
    }
  }

  const nudity = (data?.nudity && typeof data.nudity === 'object'
    ? (data.nudity as Record<string, unknown>)
    : {}) as Record<string, unknown>
  const rawProb = getProb(nudity.raw)
  const eroticaProb = getProb(nudity.erotica)
  const verySuggestiveProb = getProb(nudity.very_suggestive)
  const suggestiveProb = getProb(nudity.suggestive)
  const mildlySuggestiveProb = getProb(nudity.mildly_suggestive)

  addTrigger(
    rawProb >= 0.6,
    'nudity.raw',
    rawProb,
    'Image blocked for inappropriate content. Please choose another.',
    'nudity',
  )
  addTrigger(
    eroticaProb >= 0.6,
    'nudity.erotica',
    eroticaProb,
    'Image blocked for inappropriate content. Please choose another.',
    'nudity',
  )
  addTrigger(
    verySuggestiveProb >= 0.9,
    'nudity.very_suggestive',
    verySuggestiveProb,
    'This photo seems very suggestive. Please choose a more appropriate image.',
    'suggestive',
  )
  addTrigger(
    suggestiveProb >= 0.99,
    'nudity.suggestive',
    suggestiveProb,
    'This photo seems too suggestive. Please choose a different image.',
    'suggestive',
  )
  addTrigger(
    mildlySuggestiveProb >= 0.99,
    'nudity.mildly_suggestive',
    mildlySuggestiveProb,
    'This photo seems too suggestive. Please choose a different image.',
    'suggestive',
  )

  const goreProb = getProb(data?.gore)
  addTrigger(
    goreProb >= 0.5,
    'gore',
    goreProb,
    'Image blocked due to gore. Please select a safe photo.',
    'gore',
  )

  const violenceProb = getProb(data?.violence)
  addTrigger(
    violenceProb >= 0.5,
    'violence',
    violenceProb,
    'Image blocked due to violence. Please select a safe photo.',
    'violence',
  )

  const weaponProb = getProb(data?.weapon)
  addTrigger(
    weaponProb >= 0.5,
    'weapon',
    weaponProb,
    'Image blocked due to weapon detection. Please select a safe photo.',
    'weapon',
  )

  if (!triggered.length) {
    return null
  }

  const reasons = triggered.map((entry) => `${entry.label}:${(entry.prob * 100).toFixed(1)}%`)
  const primary = triggered[0]
  return {
    message: primary.message,
    category: primary.category,
    reasons,
  }
}

export type ModerationOutcome =
  | { ok: true }
  | {
      ok: false
      message: string
      status: number
      category?: string
      reasons?: string[]
      details?: unknown
      type: 'blocked' | 'error'
    }

const normaliseFilename = (filename?: string) => {
  if (typeof filename !== 'string' || !filename.trim()) return 'upload.jpg'
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function moderateImageBuffer(
  buffer: Buffer,
  options: { filename?: string; contentType?: string },
): Promise<ModerationOutcome> {
  const apiUser = process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_API_SECRET

  if (!apiUser || !apiSecret) {
    console.error('[sightengine] Missing credentials')
    return {
      ok: false,
      message: 'Image moderation service not configured.',
      status: 500,
      type: 'error',
    }
  }

  const payload = new FormData()
  payload.append('media', buffer, {
    filename: normaliseFilename(options.filename),
    contentType: options.contentType || 'application/octet-stream',
  })
  payload.append('models', MODELS)
  payload.append('api_user', apiUser)
  payload.append('api_secret', apiSecret)

  try {
    const response = await axios.post('https://api.sightengine.com/1.0/check.json', payload, {
      headers: payload.getHeaders(),
      timeout: 20000,
    })

    const data = response.data as SightenginePayload

    if (data?.status === 'failure') {
      console.warn('[sightengine] API failure', data)
      return {
        ok: false,
        message: 'Image moderation failed. Please try again.',
        status: 502,
        type: 'error',
        details: data,
      }
    }

    const evaluation = evaluateModeration(data)

    if (evaluation) {
      console.warn('[sightengine] Image rejected', {
        category: evaluation.category,
        reasons: evaluation.reasons,
      })

      return {
        ok: false,
        message: evaluation.message,
        status: 400,
        type: 'blocked',
        category: evaluation.category,
        reasons: evaluation.reasons,
      }
    }

    return { ok: true }
  } catch (error) {
    const err = error as AxiosError<unknown>
    if (err.response) {
      console.error('[sightengine] API error', err.response.data)
      return {
        ok: false,
        message: 'Unable to verify the image. Please try again.',
        status: 502,
        type: 'error',
        details: err.response.data,
      }
    }

    console.error('[sightengine] Unexpected error', err)
    return {
      ok: false,
      message: 'Image moderation failed. Please try again.',
      status: 500,
      type: 'error',
    }
  }
}
