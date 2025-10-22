export interface VendorAnalyticsSnapshot {
  metrics: {
    totalProducts: number
    drafts: number
    pending: number
    active: number
    rejected: number
    archived: number
  }
  recentProducts: Array<{
    id: string
    title: string
    status: string
    price: number
    currency: string
    createdAt: string | null
    updatedAt: string | null
  }>
}
