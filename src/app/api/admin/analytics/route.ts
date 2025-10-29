import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'

export const runtime = 'nodejs'

type RecentItem = {
  id: string
  label: string | null
  created_at: string | null
  role?: string | null
  status?: string | null
}

const normaliseRole = (value: string | null | undefined): string =>
  (value ?? 'user').toLowerCase()

const toIso = (value: string | null | undefined): string | null => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET() {
  try {
    const supabase = createServiceClient()
    await requireRole(supabase, 'admin')

    const countProfiles = async (
      filters?: Array<{ column: 'role'; value: string }>,
    ): Promise<number> => {
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true })
      filters?.forEach(({ column, value }) => {
        query = query.eq(column, value)
      })
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const countVendorRequests = async (
      filters?: Array<{ column: 'status'; value: string }>,
    ): Promise<number> => {
      let query = supabase.from('vendor_requests').select('id', { count: 'exact', head: true })
      filters?.forEach(({ column, value }) => {
        query = query.eq(column, value)
      })
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const countVendorProducts = async (
      filters?: Array<{ column: 'status'; value: string }>,
    ): Promise<number> => {
      let query = supabase.from('vendor_products').select('id', { count: 'exact', head: true })
      filters?.forEach(({ column, value }) => {
        query = query.eq(column, value)
      })
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const [
      totalUsers,
      totalVendors,
      totalAdmins,
      pendingRequests,
      approvedRequests,
      totalProducts,
      activeProducts,
      recentUsersResult,
      recentRequestsResult,
    ] = await Promise.all([
      countProfiles(),
      countProfiles([{ column: 'role', value: 'vendor' }]),
      countProfiles([{ column: 'role', value: 'admin' }]),
      countVendorRequests([{ column: 'status', value: 'pending' }]),
      countVendorRequests([{ column: 'status', value: 'approved' }]),
      countVendorProducts(),
      countVendorProducts([{ column: 'status', value: 'active' }]),
      supabase
        .from('profiles')
        .select('id, display_name, email, role, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('vendor_requests')
        .select('id, business_name, status, submitted_at')
        .order('submitted_at', { ascending: false })
        .limit(10),
    ])

    if (recentUsersResult.error) throw recentUsersResult.error
    if (recentRequestsResult.error) throw recentRequestsResult.error

    const recentUsers: RecentItem[] = (recentUsersResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.display_name ?? row.email ?? null,
      created_at: toIso(row.created_at),
      role: normaliseRole(row.role),
    }))

    const recentVendorRequests: RecentItem[] = (recentRequestsResult.data ?? []).map((row) => ({
      id: row.id,
      label: row.business_name ?? null,
      status: row.status ?? null,
      created_at: toIso(row.submitted_at),
    }))

    return NextResponse.json({
      metrics: {
        totals: {
          users: totalUsers,
          vendors: totalVendors,
          admins: totalAdmins,
        },
        vendorRequests: {
          pending: pendingRequests,
          approved: approvedRequests,
        },
        products: {
          total: totalProducts,
          active: activeProducts,
        },
      },
      recentUsers,
      recentVendorRequests,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load analytics.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
