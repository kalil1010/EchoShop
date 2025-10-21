import { redirect } from 'next/navigation'

import VendorDashboard from '@/components/vendor/VendorDashboard'
import BecomeVendorCard from '@/components/vendor/BecomeVendorCard'
import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapVendorProductRow } from '@/lib/vendorProducts'

const VENDOR_ROLES = new Set(['vendor', 'admin'])

export default async function VendorDashboardPage() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?redirect=${encodeURIComponent('/dashboard/vendor')}`)
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null; display_name: string | null }>()

  const role = profileData?.role?.toLowerCase() ?? 'user'
  const vendorName = profileData?.display_name ?? user.email ?? 'Vendor'

  if (!VENDOR_ROLES.has(role)) {
    return (
      <div className="container mx-auto px-4 py-10">
        <BecomeVendorCard headline="Become a ZMODA marketplace vendor" />
      </div>
    )
  }

  let initialProducts = []

  try {
    const service = createServiceClient()
    const { data: productsData, error: productsError } = await service
      .from('vendor_products')
      .select('*')
      .eq('vendor_id', user.id)
      .order('updated_at', { ascending: false })

    if (productsError) {
      throw productsError
    }

    initialProducts = (productsData ?? []).map((row) => {
      const mapped = mapVendorProductRow(row)
      return {
        ...mapped,
        createdAt: mapped.createdAt.toISOString(),
        updatedAt: mapped.updatedAt.toISOString(),
      }
    })
  } catch (error) {
    console.warn('[vendor-dashboard] vendor products unavailable, starting empty:', error)
    initialProducts = []
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <VendorDashboard initialProducts={initialProducts} vendorName={vendorName} />
    </div>
  )
}
