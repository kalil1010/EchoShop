const MISTRAL_BASE_URL = 'https://api.mistral.ai'

interface ConversationResponse {
  outputs?: Array<{
    type?: string
    content?: Array<{
      type?: string
      file_id?: string
    }>
  }>
}

export interface GeneratedImageResult {
  arrayBuffer: ArrayBuffer
  contentType: string
  fileId: string
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

  let fileId: string | undefined
  for (const output of outputs) {
    if (!output || typeof output !== 'object') continue
    const content = Array.isArray(output.content) ? output.content : []
    for (const chunk of content) {
      if (chunk?.type === 'tool_file' && typeof chunk.file_id === 'string') {
        fileId = chunk.file_id
        break
      }
    }
    if (fileId) break
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
