import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'
import { mapOrderRow, mapOrderItemRow } from '@/lib/orders'
import type { OrderRow, OrderItemRow, ShippingAddress } from '@/types/order'

export const runtime = 'nodejs'

interface CheckoutItem {
  productId: string
  quantity: number
  unitPrice: number
  currency: string
}

interface CheckoutPayload {
  items: CheckoutItem[]
  shippingAddress: ShippingAddress
  billingAddress?: ShippingAddress
  paymentMethod: string
  paymentTransactionId?: string
  customerNotes?: string
  shippingMethod?: string
  shippingCost?: number
  taxAmount?: number
  discountAmount?: number
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    const supabase = createServiceClient()

    const payload = (await request.json().catch(() => ({}))) as CheckoutPayload

    // Validate payload
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      return NextResponse.json({ error: 'Order items are required.' }, { status: 400 })
    }

    if (!payload.shippingAddress) {
      return NextResponse.json({ error: 'Shipping address is required.' }, { status: 400 })
    }

    if (!payload.paymentMethod) {
      return NextResponse.json({ error: 'Payment method is required.' }, { status: 400 })
    }

    // Get customer profile
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', userId)
      .maybeSingle<{ display_name: string | null; email: string | null }>()

    const customerName = customerProfile?.display_name || 'Customer'
    const customerEmail = customerProfile?.email || ''

    // Fetch products to get vendor IDs and product details
    const productIds = payload.items.map((item) => item.productId)
    const { data: products, error: productsError } = await supabase
      .from('vendor_products')
      .select('id, vendor_id, title, description, primary_image_url, price, currency, status')
      .in('id', productIds)
      .eq('status', 'active')

    if (productsError) {
      throw productsError
    }

    if (!products || products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more products not found or unavailable.' }, { status: 400 })
    }

    // Group items by vendor (one order per vendor)
    const vendorGroups = new Map<string, typeof payload.items>()
    const vendorProductMap = new Map<string, typeof products[0]>()

    for (const product of products) {
      vendorProductMap.set(product.id, product)
      const vendorId = product.vendor_id
      if (!vendorGroups.has(vendorId)) {
        vendorGroups.set(vendorId, [])
      }
      const item = payload.items.find((i) => i.productId === product.id)
      if (item) {
        vendorGroups.get(vendorId)!.push(item)
      }
    }

    const orders = []

    // Create an order for each vendor
    for (const [vendorId, vendorItems] of vendorGroups.entries()) {
      // Calculate totals
      let subtotal = 0
      for (const item of vendorItems) {
        const product = vendorProductMap.get(item.productId)!
        subtotal += Number(product.price) * item.quantity
      }

      const shippingCost = payload.shippingCost || 0
      const taxAmount = payload.taxAmount || 0
      const discountAmount = payload.discountAmount || 0
      const totalAmount = subtotal + shippingCost + taxAmount - discountAmount

      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number')
      const orderNumber = orderNumberData || `ORD-${Date.now()}`

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: userId,
          vendor_id: vendorId,
          status: 'pending',
          payment_status: 'pending',
          fulfillment_status: 'unfulfilled',
          subtotal: subtotal,
          tax_amount: taxAmount,
          shipping_cost: shippingCost,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          currency: vendorItems[0]?.currency || 'EGP',
          customer_name: sanitizeText(customerName, { maxLength: 255 }),
          customer_email: customerEmail,
          customer_phone: payload.shippingAddress.phone || null,
          shipping_address: payload.shippingAddress,
          billing_address: payload.billingAddress || payload.shippingAddress,
          shipping_method: payload.shippingMethod || null,
          payment_method: payload.paymentMethod,
          payment_transaction_id: payload.paymentTransactionId || null,
          customer_notes: payload.customerNotes
            ? sanitizeText(payload.customerNotes, { maxLength: 1000, allowNewlines: true })
            : null,
        })
        .select('*')
        .single<OrderRow>()

      if (orderError) {
        throw orderError
      }

      // Create order items
      const orderItems = vendorItems.map((item) => {
        const product = vendorProductMap.get(item.productId)!
        const lineTotal = Number(product.price) * item.quantity

        return {
          order_id: orderData.id,
          product_id: item.productId,
          vendor_id: vendorId,
          product_title: product.title,
          product_description: product.description || null,
          product_image_url: product.primary_image_url || null,
          product_sku: null,
          unit_price: Number(product.price),
          quantity: item.quantity,
          discount_amount: 0,
          line_total: lineTotal,
          currency: item.currency || 'EGP',
          status: 'pending' as const,
        }
      })

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select('*')

      if (itemsError) {
        throw itemsError
      }

      const order = mapOrderRow(orderData)
      const items = (itemsData as OrderItemRow[]).map(mapOrderItemRow)

      orders.push({ ...order, items })
    }

    return NextResponse.json({ orders }, { status: 201 })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to create order.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

