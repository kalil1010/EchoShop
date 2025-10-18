const DEFAULT_VISION_MODEL = process.env.MISTRAL_VISION_MODEL || 'pixtral-12b-2409'

type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type ChatCompletionChoice = {
  message?: {
    content?: string | MessageContent[]
  }
}

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[]
}

type SegmentationBoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

export type SegmentedGarment = {
  label: string
  garmentType?: string
  confidence?: number
  boundingBox: SegmentationBoundingBox
}

export type GarmentAnalysis = {
  description: string
  colors: Array<{ name: string; hex: string }>
  suggestedType?: string
  safety: {
    status: 'ok' | 'review' | 'blocked'
    reasons: string[]
  }
}

const extractTextFromChoice = (choice?: ChatCompletionChoice): string | null => {
  if (!choice?.message) return null
  const { content } = choice.message
  if (!content) return null
  if (typeof content === 'string') return content.trim() || null
  if (!Array.isArray(content)) return null
  const combined = content
    .map((entry) => ('text' in entry && typeof entry.text === 'string' ? entry.text.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .trim()
  return combined || null
}

const extractJsonFromText = <T>(payload: string): T | null => {
  if (!payload) return null
  const trimmed = payload.trim()
  const fenced = trimmed.match(/```(?:json)?([\s\S]*?)```/i)
  const target = fenced ? fenced[1].trim() : trimmed
  const start = target.indexOf('{')
  const end = target.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const jsonString = target.slice(start, end + 1)
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    console.warn('[mistral-vision] Failed to parse JSON response', error)
    return null
  }
}

const bufferToDataUrl = (imageBuffer: Buffer, mimeType: string): string =>
  `data:${mimeType};base64,${imageBuffer.toString('base64')}`

const clamp01 = (value: number): number => {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const callMistralChat = async (body: Record<string, unknown>): Promise<ChatCompletionResponse | null> => {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.warn('[mistral-vision] Missing MISTRAL_API_KEY; skipping request.')
    return null
  }

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    console.warn('[mistral-vision] Request failed', response.status, errorBody)
    return null
  }

  return (await response.json()) as ChatCompletionResponse
}

export async function segmentGarmentsWithMistral(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<SegmentedGarment[]> {
  try {
    const base64Image = bufferToDataUrl(imageBuffer, mimeType)
    const response = await callMistralChat({
      model: DEFAULT_VISION_MODEL,
      temperature: 0,
      max_tokens: 320,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a fashion vision assistant. Examine the image and identify every distinct clothing or ' +
                'accessory item. Return JSON exactly in the form {"items":[{"label":"string","type":"top|bottom|outerwear|footwear|accessory|other",' +
                '"confidence":0.0-1.0,"bounding_box":{"x":0-1,"y":0-1,"width":0-1,"height":0-1}}]}. Values must be floats between 0 and 1.',
            },
          ] satisfies MessageContent[],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Detect and return JSON for each garment. Do not include prose.',
            },
            {
              type: 'image_url',
              image_url: { url: base64Image },
            },
          ] satisfies MessageContent[],
        },
      ],
    })

    if (!response) return []

    const text = extractTextFromChoice(response.choices?.[0])
    const data = extractJsonFromText<{ items?: Array<{
      label?: string
      type?: string
      confidence?: number
      bounding_box?: { x?: number; y?: number; width?: number; height?: number }
    }> }>(text ?? '')

    const items = data?.items ?? []
    return items
      .map((item) => {
        const box = item.bounding_box ?? {}
        return {
          label: item.label?.trim() || 'Garment',
          garmentType: item.type?.trim(),
          confidence: typeof item.confidence === 'number' ? clamp01(item.confidence) : undefined,
          boundingBox: {
            x: clamp01(box.x ?? 0),
            y: clamp01(box.y ?? 0),
            width: clamp01(box.width ?? 1),
            height: clamp01(box.height ?? 1),
          },
        } satisfies SegmentedGarment
      })
      .filter((entry) => entry.boundingBox.width > 0.02 && entry.boundingBox.height > 0.02)
  } catch (error) {
    console.error('[mistral-vision] Segmentation failed', error)
    return []
  }
}

export async function analyzeGarmentWithMistral(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<GarmentAnalysis | null> {
  try {
    const base64Image = bufferToDataUrl(imageBuffer, mimeType)
    const response = await callMistralChat({
      model: DEFAULT_VISION_MODEL,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text:
                'You are a fashion expert. For the provided garment crop respond with JSON exactly in the form ' +
                '{"description":"string","suggested_type":"top|bottom|outerwear|footwear|accessory|other","colors":[{"name":"string","hex":"#RRGGBB"}],' +
                '"safety":{"status":"ok|review|blocked","reasons":["string"]}}. The description must be a single detailed sentence. ' +
                'Include 1-3 colours with estimated hex values. Reasons array may be empty.',
            },
          ] satisfies MessageContent[],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Return only JSON. No explanations.',
            },
            {
              type: 'image_url',
              image_url: { url: base64Image },
            },
          ] satisfies MessageContent[],
        },
      ],
    })

    if (!response) return null

    const text = extractTextFromChoice(response.choices?.[0])
    const data = extractJsonFromText<{
      description?: string
      suggested_type?: string
      colors?: Array<{ name?: string; hex?: string }>
      safety?: { status?: string; reasons?: string[] }
    }>(text ?? '')

    if (!data) return null

    const colors = (data.colors ?? [])
      .map((entry) => {
        const name = entry.name?.trim()
        const hex = entry.hex?.trim()
        if (!name || !hex) return null
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
        return { name, hex: hex.toUpperCase() }
      })
      .filter((value): value is { name: string; hex: string } => Boolean(value))

    const status = data.safety?.status
    const normalisedStatus = status === 'blocked' || status === 'review' ? status : 'ok'
    const reasons = Array.isArray(data.safety?.reasons) ? data.safety?.reasons.filter((reason) => typeof reason === 'string') as string[] : []

    const analysis: GarmentAnalysis = {
      description: data.description?.trim() || '',
      colors,
      suggestedType: data.suggested_type?.trim(),
      safety: {
        status: normalisedStatus,
        reasons,
      },
    }
    return analysis
  } catch (error) {
    console.error('[mistral-vision] Garment analysis failed', error)
    return null
  }
}

const SYSTEM_PROMPT =
  'You are a fashion expert AI. Carefully describe the clothing item in the provided image. ' +
  'List the garment type, visible dominant and secondary colors, material if apparent, any printed text or logos, ' +
  'embroidery, decorative elements (badges, sequins, patches), pattern or texture, sleeve and neckline details. ' +
  'Write a single concise sentence.'

export async function describeClothingFromImage(imageUrl: string): Promise<string | null> {
  const response = await callMistralChat({
    model: DEFAULT_VISION_MODEL,
    temperature: 0.2,
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: [{ type: 'text', text: SYSTEM_PROMPT }] satisfies MessageContent[],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe the clothing item in one concise sentence.',
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl },
          },
        ] satisfies MessageContent[],
      },
    ],
  })

  if (!response) return null
  const text = extractTextFromChoice(response.choices?.[0])
  return text ?? null
}

export async function describeClothingFromBuffer(
  imageBuffer: Buffer,
  mimeType = 'image/jpeg',
): Promise<string | null> {
  const dataUrl = bufferToDataUrl(imageBuffer, mimeType)
  return describeClothingFromImage(dataUrl)
}
