import type { VendorRequest } from '@/types/vendor'

export interface OwnerAnalyticsSnapshot {
  metrics: {
    totals: {
      users: number
      vendors: number
      owners: number
    }
    vendorRequests: {
      pending: number
      approved: number
    }
    products: {
      total: number
      active: number
    }
  }
  recentUsers: Array<{
    id: string
    label: string | null
    role?: string | null
    createdAt: string | null
  }>
  recentVendorRequests: Array<{
    id: string
    label: string | null
    status?: string | null
    createdAt: string | null
  }>
}

export interface OwnerUserRecord {
  id: string
  email: string | null
  displayName: string | null
  role: string
  isSuperAdmin: boolean
  vendorBusinessName?: string | null
  vendorContactEmail?: string | null
  vendorPhone?: string | null
  vendorWebsite?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface OwnerInvitationRecord {
  id: string
  invitedEmail: string
  invitedBy: string
  token: string
  status: string
  createdAt: string | null
  expiresAt: string | null
  acceptedAt: string | null
  inviter?: {
    displayName: string | null
    email: string | null
  } | null
}

export type OwnerVendorRequest = VendorRequest & {
  displayName?: string | null
}
