import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'
import { mapOrderRow, mapOrderItemRow } from '@/lib/orders'
import type { OrderRow, OrderItemRow } from '@/types/order'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('orders')
      .select('*')
      .eq('vendor_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: ordersData, error: ordersError } = await query

    if (ordersError) {
      throw ordersError
    }

    if (!ordersData || ordersData.length === 0) {
      return NextResponse.json({ orders: [], total: 0 })
    }

    // Fetch order items for each order
    const orderIds = ordersData.map((o) => o.id)
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.warn('Failed to fetch order items:', itemsError)
    }

    // Map orders and attach items
    const orders = (ordersData as OrderRow[]).map((orderRow) => {
      const order = mapOrderRow(orderRow)
      const items = (itemsData as OrderItemRow[] || [])
        .filter((item) => item.order_id === order.id)
        .map(mapOrderItemRow)
      return { ...order, items }
    })

    // Get total count for pagination
    let countQuery = supabase.from('orders').select('*', { count: 'exact', head: true }).eq('vendor_id', userId)
    if (status) {
      countQuery = countQuery.eq('status', status)
    }
    const { count } = await countQuery

    return NextResponse.json({
      orders,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load orders.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

