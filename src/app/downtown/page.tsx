import { redirect } from 'next/navigation'

import { OwnerLoginForm } from '@/components/owner/OwnerLoginForm'
import { createRouteClient } from '@/lib/supabaseServer'

export const metadata = {
  title: 'ZMODA Downtown Entry',
  description: 'Secure access for verified ZMODA owners.',
}

const normaliseRole = (value: string | null | undefined): string => value?.toLowerCase() ?? ''

export default async function DowntownEntryPage() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string | null }>()

    const role = normaliseRole(profile?.role)
    if (role === 'owner') {
      redirect('/downtown/dashboard')
    }

    if (role === 'vendor') {
      redirect('/atlas/hub?from=owner-portal')
    }

    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <OwnerLoginForm />
    </div>
  )
}
