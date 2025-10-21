import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { PermissionError, mapSupabaseError } from '@/lib/security'

export const runtime = 'nodejs'

const VENDOR_ROLE = 'vendor'
const ADMIN_ROLE = 'admin'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()
    const nowIso = new Date().toISOString()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) {
      throw profileError
    }

    const currentRole = (profile?.role ?? '').toLowerCase()
    if (currentRole === VENDOR_ROLE || currentRole === ADMIN_ROLE) {
      return NextResponse.json({ ok: true, role: currentRole })
    }

    if (!profile) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userId,
        role: VENDOR_ROLE,
        created_at: nowIso,
        updated_at: nowIso,
      })
      if (insertError) {
        throw insertError
      }
    } else {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: VENDOR_ROLE, updated_at: nowIso })
        .eq('id', userId)
      if (updateError) {
        throw updateError
      }
    }

    try {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          role: VENDOR_ROLE,
        },
      })
    } catch (metadataError) {
      console.warn('Failed to persist vendor role in auth metadata:', metadataError)
    }

    return NextResponse.json({ ok: true, role: VENDOR_ROLE })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to activate vendor role.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
