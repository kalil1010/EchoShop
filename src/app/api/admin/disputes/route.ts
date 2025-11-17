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

    let query = supabase
      .from('disputes')
      .select(`
        *,
        orders:order_id (
          order_number
        ),
        vendor:vendor_id (
          email,
          vendor_business_name
        ),
        customer:customer_id (
          email,
          display_name
        )
      `)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: disputes, error } = await query

    if (error) throw error

    const formattedDisputes = (disputes || []).map((dispute: any) => ({
      id: dispute.id,
      order_id: dispute.order_id,
      vendor_id: dispute.vendor_id,
      customer_id: dispute.customer_id,
      dispute_type: dispute.dispute_type,
      status: dispute.status,
      priority: dispute.priority,
      title: dispute.title,
      description: dispute.description,
      customer_claim: dispute.customer_claim,
      vendor_response: dispute.vendor_response,
      resolution: dispute.resolution,
      resolved_amount: dispute.resolved_amount ? Number(dispute.resolved_amount) : null,
      created_at: dispute.created_at,
      order_number: dispute.orders?.order_number,
      vendor_name: dispute.vendor?.vendor_business_name || dispute.vendor?.email,
      customer_name: dispute.customer?.display_name || dispute.customer?.email,
    }))

    return NextResponse.json({ disputes: formattedDisputes })
  } catch (error) {
    console.error('Error fetching disputes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch disputes' },
      { status: 500 }
    )
  }
}

