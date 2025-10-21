import type { FashionPiece, GenderTarget, PriceLabel } from "@/types/arrivals"
import { BRAND_PIECES } from "@/data/brandPieces"
import { createServiceClient } from '@/lib/supabaseServer'
import { mapVendorProductRow } from '@/lib/vendorProducts'
import type { VendorProduct } from '@/types/vendor'

type GenderMap = Partial<Record<GenderTarget, string[]>>

type BrandConfig = {
  slug: string
  name: string
  domain: string
  priceLabel: PriceLabel
  storeLabel: string
  limit?: number
  take?: number
  tagMap?: GenderMap
  defaultGender?: GenderTarget
}

const BRAND_CONFIGS: BrandConfig[] = [
  {
    slug: "sutra",
    name: "SUTRA",
    domain: "https://sutrastores.com",
    priceLabel: "Mid-Range",
    storeLabel: "SUTRA - Online",
    tagMap: {
      male: ["men", "mens", "menswear"],
    },
  },
  {
    slug: "sigma-fit",
    name: "Sigma Fit",
    domain: "https://sigmafiteg.com",
    priceLabel: "Mid-Range",
    storeLabel: "Sigma Fit - Online",
    tagMap: {
      male: ["men", "men shorts", "men t-shirt"],
      female: ["women", "sports bra"],
      unisex: ["unisex"],
    },
  },
  {
    slug: "jex",
    name: "JE-X",
    domain: "https://je-x.com",
    priceLabel: "Budget",
    storeLabel: "JE-X - Online",
    tagMap: {
      male: ["men", "mens"],
      female: ["women"],
    },
  },
  {
    slug: "mamzi",
    name: "Mamzi",
    domain: "https://mamzistore.com",
    priceLabel: "Premium",
    storeLabel: "Mamzi - Online",
    defaultGender: "female",
  },
  {
    slug: "gumus",
    name: "Gumus",
    domain: "https://gumus.eg",
    priceLabel: "Mid-Range",
    storeLabel: "Gumus - Online",
    defaultGender: "female",
  },
  {
    slug: "up-fuse",
    name: "Up-Fuse",
    domain: "https://up-fuse.com",
    priceLabel: "Mid-Range",
    storeLabel: "Up-Fuse - Online",
    defaultGender: "unisex",
  },
]

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const STRIP_HTML_REGEX = /<[^>]+>/g
const WHITESPACE_REGEX = /\s+/g

const IGNORED_TAG_SNIPPETS = [
  "available",
  "not-on-sale",
  "summer collection",
  "size",
  "color",
  "collection",
  "act",
  "adha",
  "og",
  "new",
]

const GENDER_KEYWORDS: Record<GenderTarget, string[]> = {
  male: [" men", " men's", " gents", " gentleman", "male"],
  female: [" women", " women's", " ladies", "feminine", "female"],
  unisex: ["unisex", "all gender", "everybody"],
}

const toSentenceCase = (value: string) =>
  value
    .split(/[\s_/\-]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")

const stripHtml = (input?: string | null) => {
  if (!input) return ""
  return input.replace(STRIP_HTML_REGEX, " ").replace(WHITESPACE_REGEX, " ").trim()
}

const pickImage = (product: ShopifyProduct) => product.images?.find((img) => img?.src)?.src ?? null

const pickPrice = (product: ShopifyProduct) => {
  const raw = product.variants?.find((variant) => variant.price)?.price
  if (!raw) return undefined
  const normalized = raw.endsWith(".00") ? raw.slice(0, -3) : raw
  return `EGP ${normalized}`
}

const formatCategories = (product: ShopifyProduct): string[] => {
  const tags = product.tags ?? []
  const filtered = tags
    .map((tag) => tag.trim())
    .filter((tag) =>
      tag &&
      !IGNORED_TAG_SNIPPETS.some((ignored) => tag.toLowerCase().includes(ignored)) &&
      tag.length <= 24,
    )
  if (filtered.length === 0 && product.product_type) {
    return [toSentenceCase(product.product_type)]
  }
  return Array.from(new Set(filtered.map(toSentenceCase))).slice(0, 3)
}

interface ShopifyVariant {
  price?: string
}

interface ShopifyImage {
  src?: string
}

interface ShopifyProduct {
  id: number
  title: string
  handle: string
  body_html?: string | null
  product_type?: string | null
  tags?: string[]
  images?: ShopifyImage[]
  variants?: ShopifyVariant[]
}

const resolveGender = (product: ShopifyProduct, config: BrandConfig): GenderTarget | null => {
  const tags = new Set((product.tags ?? []).map((tag) => tag.trim().toLowerCase()))
  const matched = new Set<GenderTarget>()

  const considerTokens = (gender: GenderTarget, tokens: string[] | undefined) => {
    if (!tokens || tokens.length === 0) return
    for (const token of tokens) {
      if (tags.has(token.toLowerCase())) {
        matched.add(gender)
        break
      }
    }
  }

  considerTokens("male", config.tagMap?.male)
  considerTokens("female", config.tagMap?.female)
  considerTokens("unisex", config.tagMap?.unisex)

  const haystack = `${product.product_type ?? ""} ${product.title ?? ""} ${stripHtml(product.body_html)}`.toLowerCase()
  for (const [gender, keywords] of Object.entries(GENDER_KEYWORDS) as [GenderTarget, string[]][]) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      matched.add(gender)
    }
  }

  if (matched.has("male") && matched.has("female")) {
    return "unisex"
  }

  if (matched.size === 1) {
    return Array.from(matched)[0]
  }

  if (matched.has("unisex")) {
    return "unisex"
  }

  return config.defaultGender ?? null
}

const createPiece = (product: ShopifyProduct, config: BrandConfig): FashionPiece | null => {
  const imageUrl = pickImage(product)
  if (!imageUrl) return null

  const gender = resolveGender(product, config)
  if (!gender) return null

  const description = stripHtml(product.body_html)
  const categories = formatCategories(product)
  const price = pickPrice(product)

  return {
    id: `${config.slug}-${product.id}`,
    title: product.title.trim(),
    description: description.length > 240 ? `${description.slice(0, 237)}…` : description,
    brand: config.name,
    gender,
    priceLabel: config.priceLabel,
    categories,
    imageUrl,
    sourceUrl: `${config.domain}/products/${product.handle}`,
    store: config.storeLabel,
    price,
    highlights: categories.slice(0, 2).concat(price ? [price] : []).slice(0, 3),
  }
}

export const fetchBrandPieces = async (config: BrandConfig): Promise<FashionPiece[]> => {
  try {
    const response = await fetch(`${config.domain}/products.json?limit=${config.limit ?? 24}`, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as { products?: ShopifyProduct[] }
    if (!Array.isArray(data.products)) {
      return []
    }

    const pieces = data.products
      .map((product) => createPiece(product, config))
      .filter((piece): piece is FashionPiece => Boolean(piece))

    return pieces.slice(0, config.take ?? 12)
  } catch (error) {
    console.error(`[fashion-pieces] failed to load ${config.name}`, error)
    return []
  }
}

export const gatherBrandPieces = async (): Promise<FashionPiece[]> => {
  const chunks = await Promise.all(BRAND_CONFIGS.map(fetchBrandPieces))
  return chunks.flat()
}

const determineVendorPriceLabel = (price: number): PriceLabel => {
  if (!Number.isFinite(price) || price <= 0) return 'Mid-Range'
  if (price < 1100) return 'Budget'
  if (price > 2400) return 'Premium'
  return 'Mid-Range'
}

const formatVendorPrice = (price: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

const mapVendorProductToPiece = (product: VendorProduct): FashionPiece | null => {
  const imageUrl = product.primaryImageUrl || product.gallery[0]?.url
  if (!imageUrl) return null

  const vendorName = product.vendorName ?? 'Marketplace Vendor'
  const formattedPrice = formatVendorPrice(product.price, product.currency)
  const highlights: string[] = []
  if (vendorName) highlights.push(vendorName)
  highlights.push(formattedPrice)
  if (product.aiColors && product.aiColors.length > 0) {
    highlights.push(product.aiColors[0].name)
  }

  return {
    id: `vendor-${product.id}`,
    title: product.title,
    description: product.description ?? product.aiDescription ?? 'Marketplace listing',
    brand: vendorName,
    gender: 'unisex',
    priceLabel: determineVendorPriceLabel(product.price),
    categories: ['Marketplace'],
    imageUrl,
    sourceUrl: '/marketplace',
    store: `${vendorName} · ZMODA Marketplace`,
    price: formattedPrice,
    highlights,
  }
}

const fetchVendorMarketplacePieces = async (): Promise<FashionPiece[]> => {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('vendor_products')
      .select(`
        id,
        vendor_id,
        title,
        description,
        price,
        currency,
        status,
        primary_image_url,
        primary_image_path,
        gallery_urls,
        gallery_paths,
        ai_description,
        ai_colors,
        created_at,
        updated_at,
        profiles(display_name)
      `)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(36)

    if (error) {
      console.warn('[fashion-pieces] failed to load vendor listings', error)
      return []
    }

    const products = (data ?? []).map(mapVendorProductRow)
    return products
      .map(mapVendorProductToPiece)
      .filter((piece): piece is FashionPiece => Boolean(piece))
  } catch (error) {
    console.warn('[fashion-pieces] vendor marketplace fetch error', error)
    return []
  }
}

export const filterPiecesByGender = (
  pieces: FashionPiece[],
  gender?: GenderTarget | null,
): FashionPiece[] => {
  if (!gender || gender === "unisex") {
    return pieces
  }
  const matching = pieces.filter((piece) => piece.gender === gender || piece.gender === "unisex")
  if (matching.length > 0) return matching
  return pieces.filter((piece) => piece.gender === "unisex")
}

const filterPiecesByOccasion = (pieces: FashionPiece[], occasion?: string | null): FashionPiece[] => {
  if (!occasion) return pieces
  const lowercase = occasion.toLowerCase()
  const formalKeywords = ['business', 'meeting', 'board', 'office', 'interview', 'corporate', 'formal']
  const formalCategories = ['tailoring', 'dress shirt', 'blazer', 'business', 'trouser', 'skirt', 'suit', 'heel', 'footwear']
  const requiresFormal = formalKeywords.some((keyword) => lowercase.includes(keyword))
  if (!requiresFormal) return pieces
  const filtered = pieces.filter((piece) => {
    const joined = `${piece.title} ${piece.categories.join(' ')}`.toLowerCase()
    if (piece.categories.some((category) => formalCategories.includes(category))) return true
    return /(shirt|blazer|jacket|trouser|skirt|dress|suit|oxford|heel)/i.test(joined)
  })
  return filtered.length > 0 ? filtered : pieces
}

export const getOnlinePieces = async (gender?: GenderTarget | null, occasion?: string | null): Promise<FashionPiece[]> => {
  const [vendorPieces, brandPieces] = await Promise.all([
    fetchVendorMarketplacePieces(),
    gatherBrandPieces().catch((error) => {
      console.warn('[fashion-pieces] failed to load brand catalogues', error)
      return [] as FashionPiece[]
    }),
  ])

  const combined = [
    ...vendorPieces,
    ...(brandPieces.length > 0 ? brandPieces : BRAND_PIECES),
  ]

  const uniquePieces: FashionPiece[] = []
  const seen = new Set<string>()
  for (const piece of combined) {
    if (!piece || seen.has(piece.id)) continue
    seen.add(piece.id)
    uniquePieces.push(piece)
  }

  const genderFiltered = filterPiecesByGender(uniquePieces, gender)
  const occasionFiltered = filterPiecesByOccasion(genderFiltered, occasion)
  return occasionFiltered.slice(0, 24)
}

export const summarisePiecesForPrompt = (
  pieces: FashionPiece[],
  limit = 12,
): string[] => {
  return pieces.slice(0, limit).map((piece) => {
    const parts = [`${piece.title} (${piece.brand})`]
    if (piece.price) parts.push(piece.price)
    if (piece.categories.length > 0) parts.push(piece.categories.join(', '))
    return parts.join(' | ')
  })
}

export type { BrandConfig }
