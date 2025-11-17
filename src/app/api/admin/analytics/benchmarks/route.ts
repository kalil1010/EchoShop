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
    const sortBy = searchParams.get('sort_by') || 'revenue'

    // Use materialized view if available, otherwise calculate
    const { data: vendorPerformance } = await supabase
      .from('analytics_vendor_performance')
      .select('*')
      .order(sortBy === 'revenue' ? 'total_revenue' : sortBy === 'orders' ? 'total_orders' : 'unique_customers', {
        ascending: false,
      })
      .limit(50)

    if (vendorPerformance && vendorPerformance.length > 0) {
      const benchmarks = vendorPerformance.map((vendor, index) => ({
        vendor_id: vendor.vendor_id,
        vendor_name: vendor.vendor_business_name || vendor.vendor_email || 'Unknown',
        total_revenue: Number(vendor.total_revenue || 0),
        total_orders: Number(vendor.total_orders || 0),
        avg_order_value: Number(vendor.avg_order_value || 0),
        unique_customers: Number(vendor.unique_customers || 0),
        active_products: Number(vendor.active_products || 0),
        rank: index + 1,
      }))

      return NextResponse.json({ benchmarks })
    }

    // Fallback: calculate from raw data
    const { data: vendors } = await supabase
      .from('profiles')
      .select('id, vendor_business_name, email')
      .eq('role', 'vendor')

    const benchmarks = await Promise.all(
      (vendors || []).map(async (vendor) => {
        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount, customer_id, id')
          .eq('vendor_id', vendor.id)
          .eq('status', 'paid')

        const { data: products } = await supabase
          .from('vendor_products')
          .select('id')
          .eq('vendor_id', vendor.id)
          .eq('status', 'active')

        const totalRevenue = (orders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
        const totalOrders = (orders || []).length
        const uniqueCustomers = new Set((orders || []).map((o) => o.customer_id)).size
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

        return {
          vendor_id: vendor.id,
          vendor_name: vendor.vendor_business_name || vendor.email || 'Unknown',
          total_revenue: totalRevenue,
          total_orders: totalOrders,
          avg_order_value: avgOrderValue,
          unique_customers: uniqueCustomers,
          active_products: (products || []).length,
          rank: 0, // Will be set after sorting
        }
      })
    )

    // Sort and rank
    benchmarks.sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.total_revenue - a.total_revenue
        case 'orders':
          return b.total_orders - a.total_orders
        case 'customers':
          return b.unique_customers - a.unique_customers
        default:
          return 0
      }
    })

    benchmarks.forEach((benchmark, index) => {
      benchmark.rank = index + 1
    })

    return NextResponse.json({ benchmarks: benchmarks.slice(0, 50) })
  } catch (error) {
    console.error('Error fetching benchmarks:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch benchmarks' },
      { status: 500 }
    )
  }
}

