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

    // Get products and orders
    const { data: products } = await supabase
      .from('vendor_products')
      .select('id, ai_colors')

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, line_total, order_id, orders!inner(status)')
      .eq('orders.status', 'paid')

    // Group by category (using ai_colors as category placeholder)
    // In production, you'd have a proper category field
    const categoryMap = new Map<string, {
      product_count: number
      order_count: number
      revenue: number
    }>()

    // Count products per category
    ;(products || []).forEach((product) => {
      const category = 'general' // Placeholder - would use actual category field
      const existing = categoryMap.get(category) || {
        product_count: 0,
        order_count: 0,
        revenue: 0,
      }
      existing.product_count++
      categoryMap.set(category, existing)
    })

    // Count orders and revenue per category
    ;(orderItems || []).forEach((item) => {
      const category = 'general' // Placeholder
      const existing = categoryMap.get(category) || {
        product_count: 0,
        order_count: 0,
        revenue: 0,
      }
      existing.order_count++
      existing.revenue += Number(item.line_total || 0)
      categoryMap.set(category, existing)
    })

    const categories = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      product_count: data.product_count,
      order_count: data.order_count,
      revenue: data.revenue,
      growth: 0, // Placeholder - would calculate from historical data
    }))

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

