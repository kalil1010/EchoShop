import { redirect } from 'next/navigation'

import { VendorLoginForm } from '@/components/vendor/VendorLoginForm'
import BecomeVendorCard from '@/components/vendor/BecomeVendorCard'
import { createRouteClient } from '@/lib/supabaseServer'

export const metadata = {
  title: 'Vendor Login | ZMODA AI',
  description: 'Sign in to manage your ZMODA marketplace storefront.',
}

const VENDOR_ROLES = new Set(['vendor', 'admin'])

export default async function VendorLoginPage() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null }>()

    role = profile?.role?.toLowerCase() ?? null
    if (role && VENDOR_ROLES.has(role)) {
      redirect('/dashboard/vendor')
    }
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          <VendorLoginForm />
        </div>
        {user ? (
          <div className="flex-1">
            <BecomeVendorCard headline="Need vendor access?" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
