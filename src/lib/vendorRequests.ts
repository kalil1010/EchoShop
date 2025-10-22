import type { VendorRequest, VendorRequestStatus } from '@/types/vendor'

type VendorRequestRow = {
  id: string
  user_id: string
  status: string
  message: string | null
  admin_notes: string | null
  decided_at: string | null
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

export function mapVendorRequestRow(row: VendorRequestRow): VendorRequest {
  return {
    id: row.id,
    userId: row.user_id,
    status: normaliseStatus(row.status),
    message: row.message ?? undefined,
    adminNotes: row.admin_notes ?? undefined,
    decidedAt: row.decided_at,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}
