import { NextRequest, NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

/**
 * GET /api/vendor/payouts/[id]
 * Get a specific payout with its transactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const { id } = await params
    const supabase = createServiceClient()

    // Get payout
    const { data: payout, error: payoutError } = await supabase
      .from('vendor_payouts')
      .select('*')
      .eq('id', id)
      .eq('vendor_id', userId)
      .maybeSingle()

    if (payoutError || !payout) {
      return NextResponse.json({ error: 'Payout not found.' }, { status: 404 })
    }

    // Get transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('vendor_payout_transactions')
      .select('*')
      .eq('payout_id', id)
      .order('created_at', { ascending: false })

    if (transactionsError) {
      throw transactionsError
    }

    return NextResponse.json({
      payout,
      transactions: transactions || [],
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to fetch payout.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

