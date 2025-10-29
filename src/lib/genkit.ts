import { Mistral } from '@mistralai/mistralai'

// Initialize Mistral AI client (no Genkit)
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY || '' })

// Helper function to call Mistral AI
export async function callMistralAI(
  prompt: string,
  systemPrompt?: string,
  options?: { responseFormat?: unknown; model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  try {
    if (!process.env.MISTRAL_API_KEY) {
      return 'Mistral AI is not configured. Please set up your API key.'
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = []

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      })
    }

    messages.push({
      role: 'user',
      content: prompt,
    })

    const response = await mistral.chat.complete({
      model: options?.model || 'mistral-large-latest',
      messages,
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 1000,
      responseFormat: options?.responseFormat,
    })

    const raw = response.choices[0]?.message?.content

    if (Array.isArray(raw)) {
      const text = raw
        .map((chunk) => {
          if (typeof chunk === 'string') return chunk
          if (chunk && typeof chunk === 'object' && 'text' in chunk) {
            const candidate = (chunk as { text?: unknown }).text
            return typeof candidate === 'string' ? candidate : ''
          }
          return ''
        })
        .join('')
        .trim()
      return text || 'No response generated'
    }

    if (typeof raw === 'string') {
      return raw
    }

    return 'No response generated'
  } catch (error) {
    console.error('Mistral AI error:', error)
    return 'Error generating response from Mistral AI'
  }
}
