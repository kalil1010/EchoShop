import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, requireRole } from '@/lib/security'
import { mapVendorRequestRow } from '@/lib/vendorRequests'
import type { VendorRequestStatus } from '@/types/vendor'
import { disableOptionalProfileColumn, extractMissingProfileColumn, filterProfilePayload } from '@/lib/profileSchema'

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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createServiceClient()
    const { user } = await requireRole(supabase, 'admin')

    const { id: requestId } = await params
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
        reviewed_by: user.id,
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId)
      .select('*')
      .maybeSingle<RequestRow>()

    if (updateError) throw updateError

    if (isApproval) {
      const userToPromote = requestRow.user_id

      const profileUpdate = filterProfilePayload({
        role: 'vendor',
        updated_at: nowIso,
        vendor_business_name: requestRow.business_name,
        vendor_business_address: requestRow.business_address,
        vendor_contact_email: requestRow.contact_email,
        vendor_phone: requestRow.phone,
        vendor_website: requestRow.website,
      })

      const { error: roleUpdateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userToPromote)

      if (roleUpdateError) {
        const missingColumn = extractMissingProfileColumn(roleUpdateError)
        if (missingColumn && disableOptionalProfileColumn(missingColumn)) {
          console.warn(
            `[vendor-requests] Optional profile column "${missingColumn}" missing during vendor approval. Retrying with core fields.`,
          )
          const fallbackUpdate = filterProfilePayload({ role: 'vendor', updated_at: nowIso })
          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(fallbackUpdate)
            .eq('id', userToPromote)
          if (fallbackError) {
            console.warn(
              '[vendor-requests] Fallback profile update failed during approval',
              fallbackError,
            )
          }
        } else {
          console.warn('[vendor-requests] Failed to update profile role during approval', roleUpdateError)
        }
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
