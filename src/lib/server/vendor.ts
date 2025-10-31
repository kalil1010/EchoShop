import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError } from '@/lib/security'
import { normaliseRole } from '@/lib/roles'

type VendorProfileRow = {
  role: string | null
  display_name: string | null
}

const ALLOWED_ROLES = new Set(['vendor', 'owner'])

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

  const role = normaliseRole(data?.role)
  if (!ALLOWED_ROLES.has(role)) {
    throw new PermissionError('forbidden', 'Vendor access is required for this action.')
  }

  return {
    role,
    display_name: data?.display_name ?? null,
  }
}
