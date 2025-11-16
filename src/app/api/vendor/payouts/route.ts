import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

interface PayoutRow {
  id: string
  vendor_id: string
  payout_number: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled'
  payout_date: string
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/vendor/payouts
 * Get payouts for the authenticated vendor
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PayoutRow['status'] | null
    const limit = Number.parseInt(searchParams.get('limit') || '50', 10)
    const includeSummary = searchParams.get('includeSummary') === 'true'

    let query = supabase
      .from('vendor_payouts')
      .select('*')
      .eq('vendor_id', userId)
      .order('payout_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    // Filter by status
    if (status && ['pending', 'processing', 'paid', 'failed', 'cancelled'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: payouts, error } = await query

    if (error) {
      throw error
    }

    // Get summary if requested
    let summary = null
    if (includeSummary) {
      const { data: summaryData, error: summaryError } = await supabase.rpc(
        'get_vendor_payout_summary',
        { p_vendor_id: userId },
      )

      if (!summaryError) {
        summary = summaryData
      }
    }

    return NextResponse.json({
      payouts: payouts || [],
      summary,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch payouts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

