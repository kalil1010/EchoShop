import { redirect } from 'next/navigation'

import { OwnerLoginForm } from '@/components/owner/OwnerLoginForm'
import { createRouteClient } from '@/lib/supabaseServer'
import { getDefaultRouteForRole, normaliseRole } from '@/lib/roles'

export const metadata = {
  title: 'ZMODA Downtown Entry',
  description: 'Secure access for verified ZMODA owners.',
}

export default async function DowntownEntryPage() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: string | null }>()

      if (profileError) {
        console.error('[downtown] Profile fetch error:', profileError)
        // If profile doesn't exist or RLS blocks it, show login form
        // The user can log in and create/update their profile
      } else if (profile) {
        const role = normaliseRole(profile.role)
        redirect(getDefaultRouteForRole(role))
      }
    } catch (error) {
      console.error('[downtown] Error checking user profile:', error)
      // On error, show login form
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <OwnerLoginForm />
    </div>
  )
}
