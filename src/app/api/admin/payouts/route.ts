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
    const vendorId = searchParams.get('vendor_id')

    // Build query - fetch payouts first, then join profiles manually
    let query = supabase
      .from('vendor_payouts')
      .select('*')
      .order('payout_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (held !== null) {
      query = query.eq('is_held', held === 'true')
    }
    if (vendorId) {
      query = query.eq('vendor_id', vendorId)
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

    // Fetch vendor profiles separately to avoid relationship errors
    const vendorIds = [...new Set((payouts || []).map((p: any) => p.vendor_id).filter(Boolean))]
    let vendorProfiles: Record<string, { email: string | null; vendor_business_name: string | null }> = {}
    
    if (vendorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, vendor_business_name')
        .in('id', vendorIds)
      
      if (profiles) {
        vendorProfiles = profiles.reduce(
          (acc, profile) => {
            acc[profile.id] = {
              email: profile.email,
              vendor_business_name: profile.vendor_business_name,
            }
            return acc
          },
          {} as Record<string, { email: string | null; vendor_business_name: string | null }>,
        )
      }
    }

    // Format payouts with vendor info
    const formattedPayouts = (payouts || []).map((payout: any) => {
      const vendor = vendorProfiles[payout.vendor_id] || {}
      return {
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
        vendor_name: vendor.vendor_business_name || null,
        vendor_email: vendor.email || null,
      }
    })

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

