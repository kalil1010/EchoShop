import axios from 'axios'
import type { AxiosError } from 'axios'
import SightengineFormData from 'form-data'
import { NextResponse } from 'next/server'

const MODELS = 'nudity-2.1,weapon,type,gore-2.0,violence'

const API_USER = process.env.SIGHTENGINE_API_USER || '1244056913'
const API_SECRET = process.env.SIGHTENGINE_API_SECRET || 'DS4wrd3ujeein2N3s5qbYog8rketceYk'

function collectReasons(data: any) {
  const reasons: string[] = []
  const threshold = 0.6

  const checkProb = (value: unknown, reason: string, customThreshold = threshold) => {
    if (typeof value === 'number' && value >= customThreshold) {
      reasons.push(`${reason} (${Math.round(value * 100)}%)`)
    }
  }

  const checkProbProperty = (obj: unknown, key: string, label: string, customThreshold = threshold) => {
    if (obj && typeof obj === 'object' && key in obj) {
      const nested = (obj as Record<string, any>)[key]
      if (nested && typeof nested === 'object' && typeof nested.prob === 'number') {
        checkProb(nested.prob, label, customThreshold)
      } else if (typeof nested === 'number') {
        checkProb(nested, label, customThreshold)
      }
    }
  }

  const nudity = data?.nudity
  if (nudity && typeof nudity === 'object') {
    for (const [key, value] of Object.entries(nudity)) {
      if (value && typeof value === 'object' && typeof (value as any).prob === 'number') {
        checkProb((value as any).prob, `nudity:${key}`)
      } else if (typeof value === 'number') {
        checkProb(value, `nudity:${key}`)
      }
    }
  }

  const weapon = data?.weapon
  if (weapon && typeof weapon === 'object') {
    checkProb((weapon as any).prob, 'weapon')
  }

  const violence = data?.violence
  if (violence && typeof violence === 'object') {
    checkProb((violence as any).prob, 'violence')
  }

  const gore = data?.gore
  if (gore && typeof gore === 'object') {
    checkProb((gore as any).prob, 'gore')
    checkProbProperty(gore, 'blood', 'gore:blood')
    checkProbProperty(gore, 'wound', 'gore:wound')
  }

  const typeCheck = data?.type
  if (typeCheck && typeof typeCheck === 'object') {
    checkProbProperty(typeCheck, 'minor', 'type:minor')
    checkProbProperty(typeCheck, 'graphic', 'type:graphic')
  }

  return reasons
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

    const reasons = collectReasons(data)

    if (reasons.length > 0) {
      console.warn('[sightengine] Image rejected', { reasons })
      return NextResponse.json(
        {
          ok: false,
          error: 'The image was blocked for inappropriate content. Please choose another.',
          reasons,
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
