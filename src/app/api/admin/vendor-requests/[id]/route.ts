import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequestStatus } from '@/types/vendor'

export const runtime = 'nodejs'

type RequestRow = {
  id: string
  user_id: string
  status: string
  message: string | null
  admin_notes: string | null
  decided_at: string | null
  business_name: string | null
  business_description: string | null
  business_address: string | null
  product_categories: string[] | null
  contact_email: string | null
  phone: string | null
  website: string | null
  tax_id: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export async function PATCH(
  request: NextRequest,
  context: any,
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle<{ role: string | null }>()

    if (profileError) throw profileError

    if (adminProfile?.role?.toLowerCase() !== 'admin') {
      throw new PermissionError('forbidden', 'Only system owners may manage vendor requests.')
    }

    const params = (context as { params?: { id?: string } })?.params ?? {}
    const requestId = params.id
    if (!requestId) {
      return NextResponse.json({ error: 'Missing request identifier.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({})) as {
      action?: 'approve' | 'reject'
      adminNotes?: string
      rejectionReason?: string
    }

    const action = body.action
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
    }

    const adminNotes =
      typeof body.adminNotes === 'string' && body.adminNotes.trim().length > 0
        ? body.adminNotes.trim()
        : null

    const rawRejectionReason =
      typeof body.rejectionReason === 'string' && body.rejectionReason.trim().length > 0
        ? body.rejectionReason.trim()
        : null

    const targetStatus: VendorRequestStatus = action === 'approve' ? 'approved' : 'rejected'
    const rejectionReason = targetStatus === 'rejected' ? rawRejectionReason ?? adminNotes : null
    const isApproval = targetStatus === 'approved'

    const { data: requestRow, error: fetchError } = await supabase
      .from('vendor_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle<RequestRow>()

    if (fetchError) throw fetchError
    if (!requestRow) {
      return NextResponse.json({ error: 'Vendor request not found.' }, { status: 404 })
    }

    if (requestRow.status === 'approved' && targetStatus === 'approved') {
      return NextResponse.json({ error: 'This request has already been approved.' }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    const { data: updatedRow, error: updateError } = await supabase
      .from('vendor_requests')
      .update({
        status: targetStatus,
        admin_notes: adminNotes,
        decided_at: nowIso,
        reviewed_at: nowIso,
        reviewed_by: userId,
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId)
      .select('*')
      .maybeSingle<RequestRow>()

    if (updateError) throw updateError

    if (isApproval) {
      const userToPromote = requestRow.user_id

      const { error: roleUpdateError } = await supabase
        .from('profiles')
        .update({
          role: 'vendor',
          updated_at: nowIso,
          vendor_business_name: requestRow.business_name,
          vendor_business_description: requestRow.business_description,
          vendor_contact_email: requestRow.contact_email,
          vendor_phone: requestRow.phone,
          vendor_website: requestRow.website,
          vendor_approved_at: nowIso,
          vendor_approved_by: userId,
        })
        .eq('id', userToPromote)

      if (roleUpdateError) {
        console.warn('[vendor-requests] Failed to update profile role during approval', roleUpdateError)
      }

      try {
        await supabase.auth.admin.updateUserById(userToPromote, {
          user_metadata: { role: 'vendor' },
        })
      } catch (metadataError) {
        console.warn('[vendor-requests] Failed to update auth metadata for vendor approval', metadataError)
      }
    }

    return NextResponse.json({ request: mapVendorRequestRow(updatedRow!) })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update vendor request.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
