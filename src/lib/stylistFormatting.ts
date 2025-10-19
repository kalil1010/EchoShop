export interface StructuredPiece {
  type: string
  color?: string
  hex?: string
  description?: string
}

export interface StructuredOutfit {
  title?: string
  summary?: string
  pieces?: StructuredPiece[]
}

export interface StructuredColorBlocks {
  complementary?: string[]
  analogous?: string[]
  neutrals?: string[]
}

export interface StructuredStylistReply {
  header?: string
  outfits?: StructuredOutfit[]
  colors?: StructuredColorBlocks
  tips?: string[]
  followUp?: string
}

const EMOJI_MAP: Array<{ test: RegExp; emoji: string }> = [
  { test: /white|ivory|cream|pearl|bone|snow/i, emoji: '⚪' },
  { test: /black|charcoal|ebony|obsidian/i, emoji: '⚫' },
  { test: /silver|gray|grey|ash|stone/i, emoji: '⚙️' },
  { test: /beige|tan|camel|khaki|sand/i, emoji: '🪵' },
  { test: /gold|yellow|honey|mustard|amber|sun/i, emoji: '🟡' },
  { test: /orange|apricot|peach|coral|copper/i, emoji: '🟠' },
  { test: /red|burgundy|crimson|scarlet|wine|maroon/i, emoji: '🔴' },
  { test: /pink|rose|blush|fuchsia|magenta/i, emoji: '🌸' },
  { test: /purple|violet|plum|lilac|lavender/i, emoji: '🟣' },
  { test: /blue|navy|teal|cobalt|azure|indigo/i, emoji: '🔵' },
  { test: /green|mint|sage|olive|emerald|forest/i, emoji: '🟢' },
  { test: /brown|chocolate|coffee|mocha|walnut/i, emoji: '🟤' },
]

const sanitizeList = (values?: unknown[]): string[] => {
  if (!Array.isArray(values)) return []
  return values
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry): entry is string => Boolean(entry))
}

const colorEmoji = (label?: string): string => {
  if (!label) return '•'
  const match = EMOJI_MAP.find(({ test }) => test.test(label))
  return match?.emoji ?? '•'
}

const capitalize = (value: string): string => {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const normaliseStructuredReply = (raw: unknown): StructuredStylistReply => {
  if (!raw || typeof raw !== 'object') {
    return {}
  }
  const data = raw as Record<string, unknown>
  const outfitsRaw = Array.isArray(data.outfits) ? data.outfits : []
  const outfits: StructuredOutfit[] = outfitsRaw.map((entry) => {
    const obj = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const piecesRaw = Array.isArray(obj.pieces) ? obj.pieces : []
    const pieces: StructuredPiece[] = piecesRaw
      .map((piece) => {
        if (!piece || typeof piece !== 'object') return null
        const pieceObj = piece as Record<string, unknown>
        const type = typeof pieceObj.type === 'string' ? pieceObj.type.trim() : ''
        if (!type) return null
        const color = typeof pieceObj.color === 'string' ? pieceObj.color.trim() : undefined
        const hex = typeof pieceObj.hex === 'string' ? pieceObj.hex.trim() : undefined
        const description = typeof pieceObj.description === 'string' ? pieceObj.description.trim() : undefined
        const cleaned: StructuredPiece = { type, color, hex, description }
        return cleaned
      })
      .filter((piece): piece is StructuredPiece => piece !== null)
    return {
      title: typeof obj.title === 'string' ? obj.title : undefined,
      summary: typeof obj.summary === 'string' ? obj.summary : undefined,
      pieces,
    }
  })

  const colorsRaw = typeof data.colors === 'object' && data.colors !== null ? (data.colors as Record<string, unknown>) : {}
  const colors: StructuredColorBlocks = {
    complementary: sanitizeList(colorsRaw.complementary as unknown[]),
    analogous: sanitizeList(colorsRaw.analogous as unknown[]),
    neutrals: sanitizeList(colorsRaw.neutrals as unknown[]),
  }

  const tips = sanitizeList(data.tips as unknown[])

  return {
    header: typeof data.header === 'string' ? data.header : undefined,
    outfits,
    colors,
    tips,
    followUp: typeof data.followUp === 'string' ? data.followUp : undefined,
  }
}

interface RenderOptions {
  userName?: string
}

export const renderStructuredReply = (payload: StructuredStylistReply, options?: RenderOptions): string => {
  const name = capitalize(options?.userName || 'there')
  const header = payload.header && payload.header.toLowerCase().includes('hi')
    ? payload.header
    : `Hi ${name}! ${payload.header ?? 'Here are some outfit ideas tailored just for you.'}`
  const lines: string[] = [`**${header.trim()}**`, '']

  const outfits = payload.outfits && payload.outfits.length > 0 ? payload.outfits : []
  if (outfits.length) {
    outfits.forEach((outfit, index) => {
      const titleSuffix = outfit.title ? ` – ${outfit.title}` : ''
      lines.push(`### Outfit ${index + 1}${titleSuffix}`)
      if (outfit.summary) {
        lines.push(outfit.summary.trim())
      }
      if (outfit.pieces && outfit.pieces.length) {
        outfit.pieces.forEach((piece) => {
          const emoji = colorEmoji(piece.color)
          const colorLabel = piece.color ? `**${piece.color}**` : ''
          const description = piece.description ? ` ${piece.description}` : ''
          lines.push(`- ${emoji} **${piece.type}:** ${colorLabel}${description}`.trim())
        })
      } else {
        lines.push('- • Outfit details coming soon.')
      }
      lines.push('')
    })
  } else {
    lines.push('### Outfit 1')
    lines.push('- • Outfit details are on the way. Let me know if you want casual, dressy, or sporty vibes.')
    lines.push('')
  }

  lines.push('### Suggested Colors')
  const colorSections: Array<{ label: string; values?: string[] }> = [
    { label: 'Complementary', values: payload.colors?.complementary },
    { label: 'Analogous', values: payload.colors?.analogous },
    { label: 'Neutrals', values: payload.colors?.neutrals },
  ]
  colorSections.forEach(({ label, values }) => {
    const list = sanitizeList(values)
    if (list.length) {
      const formatted = list.map((value) => `${colorEmoji(value)} ${value}`).join(', ')
      lines.push(`- ${label}: ${formatted}`)
    }
  })
  if (!colorSections.some(({ values }) => values && values.length)) {
    lines.push('- Complementary: • Soft neutrals')
  }
  lines.push('')

  lines.push('### Styling Tips')
  if (payload.tips && payload.tips.length) {
    payload.tips.slice(0, 3).forEach((tip) => {
      lines.push(`- ${tip}`)
    })
  } else {
    lines.push('- Mix in a favourite accessory to make the look your own.')
    lines.push('- Play with layering so you can adapt to the temperature.')
  }
  lines.push('')

  const followUp = payload.followUp || 'Which look do you want to explore first, or should I spin up another vibe?'
  lines.push(`**${followUp.trim()}**`)

  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

export const buildErrorStructuredReply = (message: string): StructuredStylistReply => ({
  header: "I ran into a snag pulling the outfits, but let's regroup.",
  outfits: [
    {
      title: 'Check Back Soon',
      pieces: [
        {
          type: 'Top',
          description: message,
        },
      ],
    },
  ],
  colors: {
    neutrals: ['Soft Charcoal', 'Warm Cream'],
  },
  tips: ['Try again in a moment, or upload a different inspiration image.'],
  followUp: 'Should I give it another go now or switch to a different style mission?',
})
