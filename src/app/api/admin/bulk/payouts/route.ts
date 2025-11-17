import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { logAuditAction } from '@/lib/auditLogger'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)

    // Verify user is admin/owner
    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { payout_ids, action } = body

    if (!Array.isArray(payout_ids) || payout_ids.length === 0) {
      return NextResponse.json({ error: 'Payout IDs are required' }, { status: 400 })
    }

    if (!['hold', 'release', 'process'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Process each payout
    for (const payoutId of payout_ids) {
      if (action === 'hold') {
        await supabase.rpc('hold_vendor_payout', {
          p_payout_id: payoutId,
          p_reason: 'Bulk hold operation',
          p_held_by: userId,
        })
      } else if (action === 'release') {
        await supabase.rpc('release_vendor_payout', {
          p_payout_id: payoutId,
          p_released_by: userId,
        })
      } else if (action === 'process') {
        // Update status to processing
        await supabase
          .from('vendor_payouts')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', payoutId)
      }
    }

    // Log audit action
    await logAuditAction({
      adminId: userId,
      actionType: `bulk_payout_${action}`,
      actionCategory: 'payout',
      description: `Bulk ${action}: ${payout_ids.length} payouts`,
      metadata: { count: payout_ids.length, payout_ids },
    })

    return NextResponse.json({ success: true, count: payout_ids.length })
  } catch (error) {
    console.error('Error performing bulk payout action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform bulk action' },
      { status: 500 }
    )
  }
}

