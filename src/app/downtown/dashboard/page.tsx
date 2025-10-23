import { redirect } from 'next/navigation'

import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout'
import { createRouteClient } from '@/lib/supabaseServer'

export const metadata = {
  title: 'Owner Dashboard | ZMODA Downtown',
  description: 'Central command for ZMODA owners to manage the AI stylist platform.',
}

const normaliseRole = (value: string | null | undefined): string => value?.toLowerCase() ?? ''

export default async function OwnerDashboardPage() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/downtown')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string | null }>()

  const role = normaliseRole(profile?.role)
  if (role !== 'owner') {
    if (role === 'vendor') {
      redirect('/atlas/hub')
    }
    redirect('/dashboard')
  }

  return (
    <main className="container mx-auto max-w-6xl px-4 py-10">
      <OwnerDashboardLayout />
    </main>
  )
}
