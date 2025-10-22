import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: actorProfile, error: actorError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (actorError) throw actorError
    if (normaliseRole(actorProfile?.role) !== 'admin') {
      throw new PermissionError('forbidden', 'Only admins can access analytics.')
    }

    const countProfiles = async (
      mutate?: (query: any) => any,
    ): Promise<number> => {
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true })
      if (mutate) {
        query = mutate(query)
      }
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const countVendorRequests = async (
      mutate?: (query: any) => any,
    ): Promise<number> => {
      let query = supabase.from('vendor_requests').select('id', { count: 'exact', head: true })
      if (mutate) {
        query = mutate(query)
      }
      const { count, error } = await query
      if (error) throw error
      return count ?? 0
    }

    const countVendorProducts = async (
      mutate?: (query: any) => any,
    ): Promise<number> => {
      let query = supabase.from('vendor_products').select('id', { count: 'exact', head: true })
      if (mutate) {
        query = mutate(query)
      }
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
      countProfiles((query) => query.eq('role', 'vendor')),
      countProfiles((query) => query.eq('role', 'admin')),
      countVendorRequests((query) => query.eq('status', 'pending')),
      countVendorRequests((query) => query.eq('status', 'approved')),
      countVendorProducts(),
      countVendorProducts((query) => query.eq('status', 'active')),
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
