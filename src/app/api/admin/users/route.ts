import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'

export const runtime = 'nodejs'

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  role: string | null
  is_super_admin: boolean | null
  vendor_business_name: string | null
  vendor_business_description: string | null
  vendor_contact_email: string | null
  vendor_phone: string | null
  vendor_website: string | null
  vendor_approved_at: string | null
  vendor_approved_by: string | null
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
  vendorBusinessDescription?: string | null
  vendorContactEmail?: string | null
  vendorPhone?: string | null
  vendorWebsite?: string | null
  vendorApprovedAt?: string | null
  vendorApprovedBy?: string | null
  createdAt: string | null
  updatedAt: string | null
}

const ROLE_SET = new Set(['user', 'vendor', 'admin'])

const normaliseRole = (value: string | null | undefined): string =>
  (value ?? 'user').toLowerCase()

const mapProfileRow = (row: ProfileRow): ProfileSummary => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  role: normaliseRole(row.role),
  isSuperAdmin: Boolean(row.is_super_admin),
  vendorBusinessName: row.vendor_business_name,
  vendorBusinessDescription: row.vendor_business_description,
  vendorContactEmail: row.vendor_contact_email,
  vendorPhone: row.vendor_phone,
  vendorWebsite: row.vendor_website,
  vendorApprovedAt: row.vendor_approved_at,
  vendorApprovedBy: row.vendor_approved_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const buildSearchPattern = (value: string): string => `%${value.replace(/[%_]/g, '')}%`

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    await requireRole(supabase, 'admin')

    const url = request.nextUrl
    const roleFilter = url.searchParams.get('role')
    const searchFilter = url.searchParams.get('search')

    let query = supabase
      .from('profiles')
      .select(
        'id, email, display_name, role, is_super_admin, vendor_business_name, vendor_business_description, vendor_contact_email, vendor_phone, vendor_website, vendor_approved_at, vendor_approved_by, created_at, updated_at',
      )
      .order('created_at', { ascending: false })

    const normalisedRoleFilter = normaliseRole(roleFilter)
    if (ROLE_SET.has(normalisedRoleFilter)) {
      query = query.eq('role', normalisedRoleFilter)
    }

    const trimmedSearch = searchFilter?.trim()
    if (trimmedSearch) {
      const pattern = buildSearchPattern(trimmedSearch)
      query = query.or(
        `email.ilike.${pattern},display_name.ilike.${pattern},vendor_business_name.ilike.${pattern}`,
      )
    }

    const { data, error } = await query
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
    const supabase = createServiceClient()
    const { profile: actorProfile } = await requireRole(supabase, 'admin')

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

    if ((requestedRole === 'admin' || targetRole === 'admin') && !actorProfile.isSuperAdmin) {
      throw new PermissionError(
        'forbidden',
        'Only the super admin may modify admin privileges.',
      )
    }

    if (targetIsSuperAdmin && requestedRole !== 'admin') {
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
      .select(
        'id, email, display_name, role, is_super_admin, vendor_business_name, vendor_business_description, vendor_contact_email, vendor_phone, vendor_website, vendor_approved_at, vendor_approved_by, created_at, updated_at',
      )
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
