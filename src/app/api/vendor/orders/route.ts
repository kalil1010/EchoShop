import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

// Placeholder for orders - this will need to be implemented when orders table exists
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    // TODO: Implement actual orders fetching once orders table is created
    // For now, return empty array
    return NextResponse.json({ orders: [] })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load orders.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

