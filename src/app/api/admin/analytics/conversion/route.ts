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

    // Get orders data
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, payment_status')

    // Placeholder data - in production, you'd track these metrics
    // For now, we'll estimate based on orders
    const ordersCompleted = (orders || []).filter(o => o.status === 'paid' || o.payment_status === 'paid').length
    const checkoutStarted = Math.round(ordersCompleted * 1.5) // Estimate
    const addToCart = Math.round(checkoutStarted * 2) // Estimate
    const productViews = Math.round(addToCart * 5) // Estimate
    const visitors = Math.round(productViews * 3) // Estimate

    const conversionRates = {
      view_to_cart: addToCart > 0 ? (addToCart / productViews) * 100 : 0,
      cart_to_checkout: checkoutStarted > 0 ? (checkoutStarted / addToCart) * 100 : 0,
      checkout_to_order: ordersCompleted > 0 ? (ordersCompleted / checkoutStarted) * 100 : 0,
      overall: visitors > 0 ? (ordersCompleted / visitors) * 100 : 0,
    }

    return NextResponse.json({
      visitors,
      product_views: productViews,
      add_to_cart: addToCart,
      checkout_started: checkoutStarted,
      orders_completed: ordersCompleted,
      conversion_rates: conversionRates,
    })
  } catch (error) {
    console.error('Error fetching conversion:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch conversion' },
      { status: 500 }
    )
  }
}

