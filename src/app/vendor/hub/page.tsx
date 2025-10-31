import { redirect } from 'next/navigation'

import VendorHub from '@/components/vendor/VendorHub'
import { normaliseRole } from '@/lib/roles'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequest } from '@/types/vendor'

export const metadata = {
  title: 'Vendor Hub | ZMODA AI',
  description: 'Submit a marketplace vendor application or view your approval status.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function VendorHubPage() {
  const routeClient = createRouteClient()
  const {
    data: { user },
  } = await routeClient.auth.getUser()

  if (!user) {
    redirect(`/auth?redirect=${encodeURIComponent('/vendor/hub')}`)
  }

  const service = createServiceClient()

  const [{ data: profileRow }, { data: requestRows }] = await Promise.all([
    service
      .from('profiles')
      .select('role, display_name')
      .eq('id', user!.id)
      .maybeSingle<{ role: string | null; display_name: string | null }>(),
    service
      .from('vendor_requests')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
  ])

  const requests: VendorRequest[] = (requestRows ?? []).map(mapVendorRequestRow)

  return (
    <div className="container mx-auto px-4 py-10">
      <VendorHub
        userName={profileRow?.display_name ?? user?.email ?? 'Creator'}
        initialRole={normaliseRole(profileRow?.role)}
        initialRequests={requests}
      />
    </div>
  )
}
