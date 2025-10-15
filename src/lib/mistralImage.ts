import { Buffer } from 'node:buffer'

const MISTRAL_BASE_URL = 'https://api.mistral.ai'

interface ConversationResponse {
  outputs?: Array<{
    type?: string
    content?: Array<{
      type?: string
      file_id?: string
      mime_type?: string
      data?: string
      url?: string
      id?: string
      name?: string
      [key: string]: unknown
    }>
    [key: string]: unknown
  }>
}

export interface GeneratedImageResult {
  arrayBuffer: ArrayBuffer
  contentType: string
  fileId: string | null
}

export async function generateImageFromPrompt(prompt: string): Promise<GeneratedImageResult> {
  const apiKey = process.env.MISTRAL_IMAGE_API_KEY
  const agentId = process.env.MISTRAL_AGENT_ID

  if (!apiKey) {
    throw new Error('MISTRAL_IMAGE_API_KEY is not configured')
  }
  if (!agentId) {
    throw new Error('MISTRAL_AGENT_ID is not configured')
  }

  const payload = {
    inputs: prompt,
    stream: false,
    agent_id: agentId,
  }

  const conversationResponse = await fetch(`${MISTRAL_BASE_URL}/v1/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!conversationResponse.ok) {
    const errorText = await conversationResponse.text()
    throw new Error(`Mistral conversation failed (${conversationResponse.status}): ${errorText}`)
  }

  const data = (await conversationResponse.json()) as ConversationResponse
  const outputs = Array.isArray(data.outputs) ? data.outputs : []

  const fileId = findFirstFileId(outputs)
  const inlineImage = fileId ? undefined : findInlineImage(outputs)

  if (!fileId && !inlineImage) {
    throw new Error('Mistral response did not include a file_id or inline image data')
  }

  if (inlineImage) {
    const buffer = decodeBase64(inlineImage.data)
    return { arrayBuffer: buffer, contentType: inlineImage.mimeType ?? 'image/png', fileId: null }
  }

  if (!fileId) {
    throw new Error('Mistral response did not include a file_id')
  }

  const imageResponse = await fetch(`${MISTRAL_BASE_URL}/v1/files/${fileId}/content`, {
    method: 'GET',
    headers: {
      Accept: 'application/octet-stream',
      'Accept-Encoding': 'gzip, deflate, zstd',
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!imageResponse.ok) {
    const errorText = await imageResponse.text()
    throw new Error(`Mistral image download failed (${imageResponse.status}): ${errorText}`)
  }

  const contentType = imageResponse.headers.get('Content-Type') ?? 'image/png'
  const arrayBuffer = await imageResponse.arrayBuffer()

  return { arrayBuffer, contentType, fileId }
}

type UnknownRecord = Record<string, unknown>

const findFirstFileId = (root: unknown): string | undefined => {
  const match = deepFind(root, (node) => typeof node?.file_id === 'string')
  return match?.file_id as string | undefined
}

const findInlineImage = (root: unknown): { data: string; mimeType?: string } | undefined => {
  const match = deepFind(
    root,
    (node) =>
      typeof node?.data === 'string' &&
      (typeof node?.mime_type === 'string' || typeof node?.content_type === 'string')
  )

  if (!match) return undefined

  const mimeType =
    (match.mime_type as string | undefined) ?? (match.content_type as string | undefined) ?? undefined

  return { data: match.data as string, mimeType }
}

const deepFind = (
  root: unknown,
  predicate: (candidate: UnknownRecord) => boolean
): UnknownRecord | undefined => {
  const stack: unknown[] = [root]
  const seen = new Set<unknown>()

  while (stack.length) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue
    if (seen.has(current)) continue
    seen.add(current)

    if (!Array.isArray(current) && predicate(current as UnknownRecord)) {
      return current as UnknownRecord
    }

    if (Array.isArray(current)) {
      for (const item of current) stack.push(item)
    } else {
      for (const value of Object.values(current as UnknownRecord)) {
        stack.push(value)
      }
    }
  }

  return undefined
}

const decodeBase64 = (data: string): ArrayBuffer => {
  const buffer = Buffer.from(data, 'base64')
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}
