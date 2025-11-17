import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { normaliseRole } from '@/lib/roles'

export const runtime = 'nodejs'

/**
 * GET /api/admin/vendors
 * Get list of all vendors (for owner/admin use)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    // Verify user is owner or admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) {
      throw profileError
    }

    const role = normaliseRole(profile?.role)
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized. Owner or admin access required.' }, { status: 403 })
    }

    const { data: vendors, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, vendor_business_name, created_at')
      .eq('role', 'vendor')
      .order('created_at', { ascending: false })

    if (error) {
      throw error
    }

    const vendorList = (vendors || []).map((v) => ({
      id: v.id,
      email: v.email,
      name: v.vendor_business_name || v.display_name || 'Vendor',
      businessName: v.vendor_business_name || null,
      displayName: v.display_name || null,
      createdAt: v.created_at,
    }))

    return NextResponse.json({ vendors: vendorList })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch vendors.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

