export type VendorProductStatus = 'draft' | 'pending_review' | 'active' | 'rejected' | 'archived'

export interface VendorProductImage {
  url: string
  path?: string
  moderationStatus?: 'ok' | 'review' | 'blocked' | 'error'
}

export interface VendorProduct {
  id: string
  vendorId: string
  title: string
  description?: string
  price: number
  currency: string
  status: VendorProductStatus
  primaryImageUrl: string
  primaryImagePath?: string
  gallery: VendorProductImage[]
  vendorName?: string
  moderation?: {
    status: 'ok' | 'review' | 'blocked' | 'error'
    message?: string
    category?: string
    reasons?: string[]
  }
  aiDescription?: string
  aiColors?: Array<{ name: string; hex: string }>
  createdAt: Date
  updatedAt: Date
}

export interface VendorProductRow {
  id: string
  vendor_id: string
  title: string
  description: string | null
  price: string | number | null
  currency: string | null
  status: string
  primary_image_url: string | null
  primary_image_path: string | null
  gallery_urls: string[] | null
  gallery_paths: string[] | null
  moderation_status: string | null
  moderation_message: string | null
  moderation_category: string | null
  moderation_reasons: string[] | null
  ai_description: string | null
  ai_colors: Array<{ name?: string; hex?: string }> | null
  created_at: string | null
  updated_at: string | null
  profiles?: { display_name: string | null } | null
}
