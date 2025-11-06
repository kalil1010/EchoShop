import { NextRequest, NextResponse } from 'next/server'

import { createRouteClient, createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'
import { normaliseRole } from '@/lib/roles'
import {
  disableOptionalProfileColumn,
  extractMissingProfileColumn,
  getActiveOptionalProfileColumns,
} from '@/lib/profileSchema'
import type { UserRole } from '@/types/user'

export const runtime = 'nodejs'

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string | null
  is_super_admin: boolean | null
  vendor_business_name?: string | null
  vendor_contact_email?: string | null
  vendor_phone?: string | null
  vendor_website?: string | null
  created_at: string | null
  updated_at: string | null
}

type ProfileSummary = {
  id: string
  email: string | null
  displayName: string | null
  role: string
  isSuperAdmin: boolean
  vendorBusinessName?: string | null
  vendorContactEmail?: string | null
  vendorPhone?: string | null
  vendorWebsite?: string | null
  createdAt: string | null
  updatedAt: string | null
}

const ROLE_SET = new Set<UserRole>(['user', 'vendor', 'owner'])

const mapProfileRow = (row: ProfileRow): ProfileSummary => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  role: normaliseRole(row.role),
  isSuperAdmin: Boolean(row.is_super_admin),
  vendorBusinessName: row.vendor_business_name,
  vendorContactEmail: row.vendor_contact_email,
  vendorPhone: row.vendor_phone,
  vendorWebsite: row.vendor_website,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const buildSearchPattern = (value: string): string => `%${value.replace(/[%_]/g, '')}%`

export async function GET(request: NextRequest) {
  try {
    // Use route client for authentication (has access to user session)
    const routeClient = createRouteClient()
    await requireRole(routeClient, 'admin')
    
    // Use service client for queries (bypasses RLS for admin operations)
    const supabase = createServiceClient()

    const url = request.nextUrl
    const roleFilter = url.searchParams.get('role')
    const searchFilter = url.searchParams.get('search')

    const trimmedSearch = searchFilter?.trim()
    const runProfilesQuery = () => {
      let listQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false })

      const normalisedRoleFilter = normaliseRole(roleFilter)
      if (ROLE_SET.has(normalisedRoleFilter)) {
        if (normalisedRoleFilter === 'owner') {
          listQuery = listQuery.in('role', ['owner', 'admin'])
        } else {
          listQuery = listQuery.eq('role', normalisedRoleFilter)
        }
      }

      if (trimmedSearch) {
        const pattern = buildSearchPattern(trimmedSearch)
        const searchColumns = ['email', 'display_name']
        if (getActiveOptionalProfileColumns().includes('vendor_business_name')) {
          searchColumns.push('vendor_business_name')
        }
        const searchExpression = searchColumns
          .map((column) => `${column}.ilike.${pattern}`)
          .join(',')
        listQuery = listQuery.or(searchExpression)
      }
      return listQuery
    }

    let { data, error } = await runProfilesQuery()

    if (error) {
      const missingColumn = extractMissingProfileColumn(error)
      if (missingColumn && disableOptionalProfileColumn(missingColumn)) {
        console.warn(
          `[admin/users] Optional profile column "${missingColumn}" missing. Retrying list fetch without it.`,
        )
        ;({ data, error } = await runProfilesQuery())
      }
    }

    if (error) throw error

    const users = (data ?? []).map(mapProfileRow)
    return NextResponse.json({ users })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load users.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Use route client for authentication (has access to user session)
    const routeClient = createRouteClient()
    const { profile: actorProfile } = await requireRole(routeClient, 'admin')
    
    // Use service client for queries (bypasses RLS for admin operations)
    const supabase = createServiceClient()

    const payload = (await request.json().catch(() => ({}))) as {
      userId?: string
      role?: string
    }

    const targetId = payload.userId?.trim()
    const requestedRole = normaliseRole(payload.role)

    if (!targetId) {
      return NextResponse.json({ error: 'Target user id is required.' }, { status: 400 })
    }

    if (!ROLE_SET.has(requestedRole)) {
      return NextResponse.json({ error: 'Requested role is invalid.' }, { status: 400 })
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('role, is_super_admin')
      .eq('id', targetId)
      .maybeSingle<{ role: string | null; is_super_admin: boolean | null }>()

    if (targetError) throw targetError
    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const targetRole = normaliseRole(targetProfile.role)
    const targetIsSuperAdmin = Boolean(targetProfile.is_super_admin)

    if ((requestedRole === 'owner' || targetRole === 'owner') && !actorProfile.isSuperAdmin) {
      throw new PermissionError(
        'forbidden',
        'Only the super admin may modify owner-level privileges.',
      )
    }

    if (targetIsSuperAdmin && requestedRole !== 'owner') {
      return NextResponse.json(
        { error: 'Super admin privileges cannot be revoked via the dashboard.' },
        { status: 400 },
      )
    }

    if (targetRole === requestedRole) {
      return NextResponse.json({ message: 'No changes applied.' })
    }

    const nowIso = new Date().toISOString()

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        role: requestedRole,
        updated_at: nowIso,
      })
      .eq('id', targetId)
      .select('*')
      .maybeSingle<ProfileRow>()

    if (updateError) throw updateError
    if (!updatedProfile) {
      return NextResponse.json({ error: 'Unable to update user role.' }, { status: 500 })
    }

    try {
      await supabase.auth.admin.updateUserById(targetId, {
        user_metadata: { role: requestedRole },
      })
    } catch (metadataError) {
      console.warn('[admin/users] Failed to update auth metadata role', metadataError)
    }

    return NextResponse.json({ user: mapProfileRow(updatedProfile) })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update user.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
