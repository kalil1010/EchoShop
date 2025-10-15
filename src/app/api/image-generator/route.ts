import { Buffer } from 'node:buffer'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { generateImageFromPrompt } from '@/lib/mistralImage'

export const runtime = 'nodejs'

const PayloadSchema = z.object({
  prompt: z
    .string()
    .min(4, 'Prompt is too short')
    .max(600, 'Prompt is too long'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = PayloadSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { prompt } = parsed.data

    const { arrayBuffer, contentType, fileId } = await generateImageFromPrompt(prompt)

    const buffer = Buffer.from(arrayBuffer)

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }

    if (fileId) {
      headers['X-Mistral-File-Id'] = fileId
    }

    return new NextResponse(buffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Image generation failed:', error)
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
