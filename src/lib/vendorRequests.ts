import type { VendorRequest, VendorRequestStatus } from '@/types/vendor'

type VendorRequestRow = {
  id: string
  user_id: string
  status: string
  message: string | null
  admin_notes: string | null
  decided_at: string | null
  business_name: string | null
  business_description: string | null
  business_address: string | null
  product_categories: string[] | null
  contact_email: string | null
  phone: string | null
  website: string | null
  tax_id: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string | null
  updated_at: string | null
  profiles?: { display_name: string | null } | null
}

const STATUS_MAP: Record<string, VendorRequestStatus> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
}

const normaliseStatus = (value: string | null | undefined): VendorRequestStatus => {
  if (value) {
    const key = value.toLowerCase()
    if (STATUS_MAP[key]) {
      return STATUS_MAP[key]
    }
  }
  return 'pending'
}

const toIso = (input: string | null | undefined): string => {
  if (!input) return new Date(0).toISOString()
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString()
  }
  return date.toISOString()
}

const toIsoOrNull = (input: string | null | undefined): string | null => {
  if (!input) return null
  return toIso(input)
}

export function mapVendorRequestRow(row: VendorRequestRow): VendorRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: normaliseStatus(row.status),
    message: row.message ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    decidedAt: row.decided_at,
    businessName: row.business_name ?? undefined,
    businessDescription: row.business_description ?? undefined,
    businessAddress: row.business_address ?? undefined,
    productCategories: row.product_categories ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    taxId: row.tax_id ?? undefined,
    submittedAt: toIso(row.submitted_at ?? row.created_at),
    reviewedAt: toIsoOrNull(row.reviewed_at),
    reviewedBy: row.reviewed_by ?? null,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}
