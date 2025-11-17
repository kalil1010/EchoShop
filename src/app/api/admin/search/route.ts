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
    const query = searchParams.get('q')
    const type = searchParams.get('type')

    if (!query) {
      return NextResponse.json({ results: [] })
    }

    const results: Array<{
      type: string
      id: string
      title: string
      description: string
      metadata: Record<string, unknown>
    }> = []

    // Search users
    if (!type || type === 'user') {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, display_name, role')
        .or(`email.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(10)

      ;(users || []).forEach((user) => {
        results.push({
          type: 'user',
          id: user.id,
          title: user.display_name || user.email || 'Unknown',
          description: user.email || '',
          metadata: { role: user.role },
        })
      })
    }

    // Search vendors
    if (!type || type === 'vendor') {
      const { data: vendors } = await supabase
        .from('profiles')
        .select('id, email, vendor_business_name, role')
        .eq('role', 'vendor')
        .or(`email.ilike.%${query}%,vendor_business_name.ilike.%${query}%`)
        .limit(10)

      ;(vendors || []).forEach((vendor) => {
        results.push({
          type: 'vendor',
          id: vendor.id,
          title: vendor.vendor_business_name || vendor.email || 'Unknown',
          description: vendor.email || '',
          metadata: {},
        })
      })
    }

    // Search products
    if (!type || type === 'product') {
      const { data: products } = await supabase
        .from('vendor_products')
        .select('id, title, description')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10)

      ;(products || []).forEach((product) => {
        results.push({
          type: 'product',
          id: product.id,
          title: product.title,
          description: product.description || '',
          metadata: {},
        })
      })
    }

    // Search orders
    if (!type || type === 'order') {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, status')
        .ilike('order_number', `%${query}%`)
        .limit(10)

      ;(orders || []).forEach((order) => {
        results.push({
          type: 'order',
          id: order.id,
          title: order.order_number || order.id,
          description: `Total: ${order.total_amount} EGP • Status: ${order.status}`,
          metadata: { status: order.status, total_amount: order.total_amount },
        })
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Error performing search:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform search' },
      { status: 500 }
    )
  }
}

