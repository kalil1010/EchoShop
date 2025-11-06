import { redirect } from 'next/navigation'

import { OwnerLoginForm } from '@/components/owner/OwnerLoginForm'
import { createRouteClient } from '@/lib/supabaseServer'
import { getDefaultRouteForRole, normaliseRole } from '@/lib/roles'

export const metadata = {
  title: 'ZMODA Downtown Entry',
  description: 'Secure access for verified ZMODA owners.',
}

export default async function DowntownEntryPage() {
  try {
    const supabase = createRouteClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If there's an auth error or no user, show login form
    if (authError || !user) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
          <OwnerLoginForm />
        </div>
      )
    }

    // User exists, try to get their profile
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle<{ role: string | null }>()

      // If profile exists and has a role, redirect to appropriate dashboard
      if (!profileError && profile?.role) {
        const role = normaliseRole(profile.role)
        const defaultRoute = getDefaultRouteForRole(role)
        redirect(defaultRoute)
      }
      // If no profile or error, show login form (user can log in to create/update profile)
    } catch (profileError) {
      // Profile query failed, show login form
      console.error('[downtown] Profile query error:', profileError)
    }
  } catch (error) {
    // Any other error (e.g., Supabase client creation), show login form
    console.error('[downtown] Page error:', error)
  }

  // Default: show login form
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <OwnerLoginForm />
    </div>
  )
}
