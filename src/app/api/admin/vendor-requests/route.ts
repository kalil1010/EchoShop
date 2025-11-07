import { NextRequest, NextResponse } from 'next/server'

import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequest } from '@/types/vendor'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Use route client for authentication (has access to user session)
    const routeClient = createRouteClient()
    await requireRole(routeClient, 'owner')
    
    // Use service client for queries (bypasses RLS for admin operations)
    const supabase = createServiceClient()

    const status = request.nextUrl.searchParams.get('status')?.toLowerCase()
    const query = supabase
      .from('vendor_requests')
      .select(`*, profiles!inner(display_name)`)
      .order('created_at', { ascending: false })

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    const requests: Array<VendorRequest & { displayName?: string | null }> = (data ?? []).map((row) => {
      const mapped = mapVendorRequestRow(row)
      const profileInfo = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        ...mapped,
        displayName: profileInfo?.display_name ?? null,
      }
    })

    return NextResponse.json({ requests })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch vendor requests.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
