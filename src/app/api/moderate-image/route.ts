import axios from 'axios'
import type { AxiosError } from 'axios'
import SightengineFormData from 'form-data'
import { NextResponse } from 'next/server'

const MODELS = 'nudity-2.1,weapon,type,gore-2.0,violence'

const API_USER = process.env.SIGHTENGINE_API_USER || '1244056913'
const API_SECRET = process.env.SIGHTENGINE_API_SECRET || 'DS4wrd3ujeein2N3s5qbYog8rketceYk'

type BlockResult = {
  message: string
  category: string
  reasons: string[]
}

type Evaluation = BlockResult | null

const getProb = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    const prob = candidate.prob ?? candidate.probability ?? candidate.value
    if (typeof prob === 'number') return prob
  }
  return 0
}

function evaluateModeration(data: any): Evaluation {
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

  const nudity = data?.nudity ?? {}
  const rawProb = getProb((nudity as any).raw)
  const eroticaProb = getProb((nudity as any).erotica)
  const verySuggestiveProb = getProb((nudity as any).very_suggestive)
  const suggestiveProb = getProb((nudity as any).suggestive)
  const mildlySuggestiveProb = getProb((nudity as any).mildly_suggestive)

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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided for moderation.' }, { status: 400 })
    }

    if (!API_USER || !API_SECRET) {
      console.error('[sightengine] Missing credentials.')
      return NextResponse.json({ ok: false, error: 'Image moderation service not configured.' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const payload = new SightengineFormData()
    payload.append('media', buffer, {
      filename: file.name || 'upload.jpg',
      contentType: file.type || 'application/octet-stream',
    })
    payload.append('models', MODELS)
    payload.append('api_user', API_USER)
    payload.append('api_secret', API_SECRET)

    const response = await axios.post('https://api.sightengine.com/1.0/check.json', payload, {
      headers: payload.getHeaders(),
      timeout: 20000,
    })

    const data = response.data

    if (data?.status === 'failure') {
      console.warn('[sightengine] API failure', data)
      return NextResponse.json({ ok: false, error: 'Image moderation failed. Please try again.' }, { status: 502 })
    }

    const evaluation = evaluateModeration(data)

    if (evaluation) {
      console.warn('[sightengine] Image rejected', {
        category: evaluation.category,
        reasons: evaluation.reasons,
      })

      return NextResponse.json(
        {
          ok: false,
          error: evaluation.message,
          category: evaluation.category,
          reasons: evaluation.reasons,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const err = error as AxiosError<any>
    if (err.response) {
      console.error('[sightengine] API error', err.response.data)
      return NextResponse.json(
        {
          ok: false,
          error: 'Unable to verify the image. Please try again.',
          details: err.response.data,
        },
        { status: 502 },
      )
    }
    console.error('[sightengine] Unexpected error', err)
    return NextResponse.json({ ok: false, error: 'Image moderation failed. Please try again.' }, { status: 500 })
  }
}
