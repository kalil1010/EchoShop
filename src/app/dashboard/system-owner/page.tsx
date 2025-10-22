import { redirect } from 'next/navigation'

import SystemOwnerVendorRequests from '@/components/vendor/SystemOwnerVendorRequests'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequest } from '@/types/vendor'

export const metadata = {
  title: 'System Owner Dashboard | ZMODA AI',
  description: 'Review vendor applications and approve marketplace access.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SystemOwnerDashboardPage() {
  const routeClient = createRouteClient()
  const {
    data: { user },
  } = await routeClient.auth.getUser()

  if (!user) {
    redirect(`/auth?redirect=${encodeURIComponent('/dashboard/system-owner')}`)
  }

  const service = createServiceClient()

  const { data: profileRow } = await service
    .from('profiles')
    .select('role, display_name')
    .eq('id', user!.id)
    .maybeSingle<{ role: string | null; display_name: string | null }>()

  if (profileRow?.role?.toLowerCase() !== 'admin') {
    redirect('/')
  }

  const { data: requestRows } = await service
    .from('vendor_requests')
    .select(`*, profiles(display_name)`)
    .order('created_at', { ascending: false })

  const requests: Array<VendorRequest & { displayName?: string | null }> = (requestRows ?? []).map((row) => {
    const mapped = mapVendorRequestRow(row)
    const profileInfo = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      ...mapped,
      displayName: profileInfo?.display_name ?? null,
    }
  })

  return (
    <div className="container mx-auto px-4 py-10">
      <SystemOwnerVendorRequests initialRequests={requests} />
    </div>
  )
}
