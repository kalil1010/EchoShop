import { NextResponse } from 'next/server'

import { moderateImageBuffer } from '@/lib/imageModeration'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided for moderation.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const outcome = await moderateImageBuffer(buffer, {
      filename: file.name,
      contentType: file.type,
    })

    if (outcome.ok) {
      return NextResponse.json({ ok: true })
    }

    const { message, status, category, reasons, type } = outcome
    if (type === 'blocked') {
      return NextResponse.json(
        { ok: false, error: message, category, reasons },
        { status },
      )
    }

    return NextResponse.json({ ok: false, error: message }, { status })
  } catch (error) {
    console.error('[sightengine] Unexpected error', error)
    return NextResponse.json({ ok: false, error: 'Image moderation failed. Please try again.' }, { status: 500 })
  }
}
