import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabaseServer'
import { resolveAuthenticatedUser } from '@/lib/server/auth'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const held = searchParams.get('held')

    // Build query
    let query = supabase
      .from('vendor_payouts')
      .select(`
        *,
        profiles:vendor_id (
          email,
          vendor_business_name
        )
      `)
      .order('payout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (held !== null) {
      query = query.eq('is_held', held === 'true')
    }

    const { data: payouts, error } = await query

    if (error) throw error

    // Calculate summary
    const { data: allPayouts } = await supabase
      .from('vendor_payouts')
      .select('status, amount, is_held')

    const summary = {
      total_pending: allPayouts?.filter(p => p.status === 'pending').length || 0,
      total_held: allPayouts?.filter(p => p.is_held).length || 0,
      total_processing: allPayouts?.filter(p => p.status === 'processing').length || 0,
      total_paid: allPayouts?.filter(p => p.status === 'paid').length || 0,
      total_failed: allPayouts?.filter(p => p.status === 'failed').length || 0,
      pending_amount: allPayouts?.filter(p => p.status === 'pending' && !p.is_held)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0,
      held_amount: allPayouts?.filter(p => p.is_held)
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0,
    }

    // Format payouts with vendor info
    const formattedPayouts = (payouts || []).map((payout: any) => ({
      id: payout.id,
      vendor_id: payout.vendor_id,
      payout_number: payout.payout_number,
      amount: Number(payout.amount),
      currency: payout.currency,
      status: payout.status,
      payout_date: payout.payout_date,
      paid_at: payout.paid_at,
      is_held: payout.is_held || false,
      hold_reason: payout.hold_reason,
      dispute_count: payout.dispute_count || 0,
      chargeback_count: payout.chargeback_count || 0,
      refund_amount: Number(payout.refund_amount || 0),
      kyc_verified: payout.kyc_verified || false,
      tax_docs_verified: payout.tax_docs_verified || false,
      compliance_status: payout.compliance_status || 'pending',
      vendor_name: payout.profiles?.vendor_business_name,
      vendor_email: payout.profiles?.email,
    }))

    return NextResponse.json({
      payouts: formattedPayouts,
      summary,
    })
  } catch (error) {
    console.error('Error fetching payouts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payouts' },
      { status: 500 }
    )
  }
}

