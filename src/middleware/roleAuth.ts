import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Session } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { normaliseRole } from '@/lib/roles'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import type { UserRole } from '@/types/user'

type RoleCheckResult = {
  session: Session
  profile: {
    role: UserRole
    isSuperAdmin: boolean
  }
}

interface RoleOptions {
  requireSuperAdmin?: boolean
}

export async function requireRole(
  allowedRoles: UserRole[],
  options: RoleOptions = {},
): Promise<RoleCheckResult> {
  const supabase = createRouteHandlerClient({ cookies })
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    // mapSupabaseError will handle refresh token errors silently
    throw mapSupabaseError(error)
  }

  const session = data?.session
  if (!session?.user) {
    throw new PermissionError('auth', 'You must be logged in to continue.')
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', session.user.id)
    .maybeSingle<{ role: string | null; is_super_admin: boolean | null }>()

  if (profileError) {
    throw mapSupabaseError(profileError)
  }

  const role = normaliseRole(profileRow?.role)
  const isSuperAdmin = Boolean(profileRow?.is_super_admin)

  if (!allowedRoles.includes(role)) {
    throw new PermissionError('forbidden', 'You are not authorized to access this resource.')
  }

  if (options.requireSuperAdmin && !isSuperAdmin) {
    throw new PermissionError('forbidden', 'Super admin privileges are required for this action.')
  }

  return {
    session,
    profile: {
      role,
      isSuperAdmin,
    },
  }
}
