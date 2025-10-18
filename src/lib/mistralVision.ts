const DEFAULT_VISION_MODEL = process.env.MISTRAL_VISION_MODEL || 'pixtral-12b-2409'

const SYSTEM_PROMPT =
  'You are a fashion expert AI. Carefully describe the clothing item in the provided image. ' +
  'List the garment type, visible dominant and secondary colors, material if apparent, any printed text or logos, ' +
  'embroidery, decorative elements (badges, sequins, patches), pattern or texture, sleeve and neckline details. ' +
  'Write a single concise sentence.'

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

export async function describeClothingFromImage(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.warn('[mistral-vision] Missing MISTRAL_API_KEY; skipping vision description.')
    return null
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_VISION_MODEL,
        temperature: 0.2,
        max_tokens: 120,
        messages: [
          {
            role: 'system',
            content: [{ type: 'text', text: SYSTEM_PROMPT }],
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
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.warn('[mistral-vision] Request failed', response.status, errorBody)
      return null
    }

    const data = (await response.json()) as ChatCompletionResponse
    const choice = data.choices?.[0]
    const text = extractTextFromChoice(choice)
    return text ?? null
  } catch (error) {
    console.error('[mistral-vision] Unexpected error', error)
    return null
  }
}
