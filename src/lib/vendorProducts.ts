import type { VendorProduct, VendorProductImage, VendorProductRow, VendorProductStatus } from '@/types/vendor'

type ModerationStatus = 'ok' | 'review' | 'blocked' | 'error'

const STATUS_MAP: Record<string, VendorProductStatus> = {
  draft: 'draft',
  pending_review: 'pending_review',
  pending: 'pending_review',
  active: 'active',
  approved: 'active',
  rejected: 'rejected',
  archived: 'archived',
}

const MODERATION_STATUSES = new Set<ModerationStatus>(['ok', 'review', 'blocked', 'error'])
const DEFAULT_STATUS: VendorProductStatus = 'pending_review'
const DEFAULT_CURRENCY = 'EGP'

const toDate = (value: string | null | undefined): Date => {
  if (!value) return new Date()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

const normaliseStatus = (value: string | null | undefined): VendorProductStatus => {
  if (typeof value === 'string') {
    const key = value.toLowerCase()
    if (key in STATUS_MAP) {
      return STATUS_MAP[key]
    }
  }
  return DEFAULT_STATUS
}

const normalisePrice = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

const ensureCurrency = (value: string | null | undefined): string => {
  if (!value) return DEFAULT_CURRENCY
  const trimmed = value.trim().toUpperCase()
  return trimmed || DEFAULT_CURRENCY
}

const buildGallery = (
  primaryUrl: string | null | undefined,
  primaryPath: string | null | undefined,
  galleryUrls: string[] | null | undefined,
  galleryPaths: string[] | null | undefined,
): VendorProductImage[] => {
  const images: VendorProductImage[] = []

  const pushImage = (url?: string | null, path?: string | null) => {
    if (!url) return
    if (images.some((image) => image.url === url)) return
    images.push({ url, path: path ?? undefined })
  }

  pushImage(primaryUrl, primaryPath)

  if (Array.isArray(galleryUrls)) {
    galleryUrls.forEach((url, index) => {
      const path = Array.isArray(galleryPaths) ? galleryPaths[index] : undefined
      pushImage(url, path)
    })
  }

  if (!images.length && primaryUrl) {
    images.push({ url: primaryUrl, path: primaryPath ?? undefined })
  }

  return images
}

const normaliseAiColors = (
  value: Array<{ name?: string; hex?: string }> | null | undefined,
): Array<{ name: string; hex: string }> | undefined => {
  if (!Array.isArray(value)) return undefined
  const unique = new Map<string, { name: string; hex: string }>()
  value.forEach((entry) => {
    const name = (entry?.name ?? '').trim()
    const hex = (entry?.hex ?? '').trim()
    if (!name || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return
    const upperHex = hex.toUpperCase()
    if (!unique.has(upperHex)) {
      unique.set(upperHex, { name, hex: upperHex })
    }
  })
  return unique.size ? Array.from(unique.values()) : undefined
}

const normaliseReasons = (value: string[] | null | undefined): string[] | undefined => {
  if (!Array.isArray(value)) return undefined
  const cleaned = value
    .map((reason) => (typeof reason === 'string' ? reason.trim() : ''))
    .filter(Boolean)
  return cleaned.length ? cleaned : undefined
}

export function mapVendorProductRow(row: VendorProductRow): VendorProduct {
  const primaryImageUrl = row.primary_image_url ?? ''
  const primaryImagePath = row.primary_image_path ?? undefined
  const gallery = buildGallery(primaryImageUrl, primaryImagePath, row.gallery_urls, row.gallery_paths)
  const moderationStatus =
    typeof row.moderation_status === 'string' ? (row.moderation_status.toLowerCase() as ModerationStatus) : null
  const profileValue = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const vendorName = profileValue?.display_name ?? undefined

  return {
    id: row.id,
    vendorId: row.vendor_id,
    title: row.title,
    description: row.description ?? undefined,
    price: normalisePrice(row.price),
    currency: ensureCurrency(row.currency),
    status: normaliseStatus(row.status),
    primaryImageUrl,
    primaryImagePath,
    gallery,
    moderation:
      moderationStatus && MODERATION_STATUSES.has(moderationStatus)
        ? {
            status: moderationStatus,
            message: row.moderation_message ?? undefined,
            category: row.moderation_category ?? undefined,
            reasons: normaliseReasons(row.moderation_reasons),
          }
        : undefined,
    aiDescription: row.ai_description ?? undefined,
    aiColors: normaliseAiColors(row.ai_colors),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    vendorName,
  }
}

