import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError } from '@/lib/security'

type VendorProfileRow = {
  role: string | null
  display_name: string | null
}

const VENDOR_ROLES = new Set(['vendor', 'admin'])

export async function requireVendorUser(userId: string): Promise<VendorProfileRow> {
  const client = createServiceClient()
  const { data, error } = await client
    .from('profiles')
    .select('role, display_name')
    .eq('id', userId)
    .maybeSingle<VendorProfileRow>()

  if (error) {
    throw error
  }

  const role = (data?.role ?? '').toLowerCase()
  if (!VENDOR_ROLES.has(role)) {
    throw new PermissionError('forbidden', 'Vendor access is required for this action.')
  }

  return {
    role: role as VendorProfileRow['role'],
    display_name: data?.display_name ?? null,
  }
}
