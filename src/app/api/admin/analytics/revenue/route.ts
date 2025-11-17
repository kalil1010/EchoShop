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
    const period = searchParams.get('period') || '30d'

    // Calculate date range
    const now = new Date()
    let startDate: Date
    let previousStartDate: Date

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        previousStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(0)
        previousStartDate = new Date(0)
    }

    // Get current period data
    const { data: currentOrders } = await supabase
      .from('orders')
      .select('total_amount, status')
      .eq('status', 'paid')
      .gte('created_at', startDate.toISOString())

    // Get previous period data
    const { data: previousOrders } = period !== 'all'
      ? await supabase
          .from('orders')
          .select('total_amount, status')
          .eq('status', 'paid')
          .gte('created_at', previousStartDate.toISOString())
          .lt('created_at', startDate.toISOString())
      : { data: [] }

    // Get all-time data
    const { data: allOrders } = await supabase
      .from('orders')
      .select('total_amount, status')
      .eq('status', 'paid')

    const totalRevenue = (allOrders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const periodRevenue = (currentOrders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const previousRevenue = (previousOrders || []).reduce((sum, o) => sum + Number(o.total_amount || 0), 0)

    const periodGrowth = previousRevenue > 0
      ? ((periodRevenue - previousRevenue) / previousRevenue) * 100
      : 0

    const totalOrders = (allOrders || []).length
    const periodOrders = (currentOrders || []).length
    const previousOrdersCount = (previousOrders || []).length

    const ordersGrowth = previousOrdersCount > 0
      ? ((periodOrders - previousOrdersCount) / previousOrdersCount) * 100
      : 0

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const periodAvgOrderValue = periodOrders > 0 ? periodRevenue / periodOrders : 0
    const previousAvgOrderValue = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0

    const aovGrowth = previousAvgOrderValue > 0
      ? ((periodAvgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100
      : 0

    return NextResponse.json({
      total_revenue: totalRevenue,
      period_revenue: periodRevenue,
      period_growth: periodGrowth,
      total_orders: totalOrders,
      period_orders: periodOrders,
      orders_growth: ordersGrowth,
      avg_order_value: avgOrderValue,
      period_avg_order_value: periodAvgOrderValue,
      aov_growth: aovGrowth,
    })
  } catch (error) {
    console.error('Error fetching revenue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch revenue' },
      { status: 500 }
    )
  }
}

