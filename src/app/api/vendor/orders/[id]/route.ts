import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'
import { mapOrderRow, mapOrderItemRow } from '@/lib/orders'
import type { OrderRow, OrderItemRow, OrderStatus, PaymentStatus, FulfillmentStatus } from '@/types/order'

export const runtime = 'nodejs'

const STATUS_ALLOWLIST: Record<string, OrderStatus> = {
  pending: 'pending',
  paid: 'paid',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'refunded',
}

const PAYMENT_STATUS_ALLOWLIST: Record<string, PaymentStatus> = {
  pending: 'pending',
  paid: 'paid',
  failed: 'failed',
  refunded: 'refunded',
}

const FULFILLMENT_STATUS_ALLOWLIST: Record<string, FulfillmentStatus> = {
  unfulfilled: 'unfulfilled',
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

const normaliseStatus = (value: unknown): OrderStatus | undefined => {
  if (typeof value !== 'string') return undefined
  const key = value.toLowerCase()
  return STATUS_ALLOWLIST[key]
}

const normalisePaymentStatus = (value: unknown): PaymentStatus | undefined => {
  if (typeof value !== 'string') return undefined
  const key = value.toLowerCase()
  return PAYMENT_STATUS_ALLOWLIST[key]
}

const normaliseFulfillmentStatus = (value: unknown): FulfillmentStatus | undefined => {
  if (typeof value !== 'string') return undefined
  const key = value.toLowerCase()
  return FULFILLMENT_STATUS_ALLOWLIST[key]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Fetch order
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('vendor_id', userId)
      .maybeSingle<OrderRow>()

    if (orderError) {
      throw orderError
    }

    if (!orderData) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    // Fetch order items
    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (itemsError) {
      console.warn('Failed to fetch order items:', itemsError)
    }

    const order = mapOrderRow(orderData)
    const items = (itemsData as OrderItemRow[] || []).map(mapOrderItemRow)

    return NextResponse.json({ order: { ...order, items } })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load order.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Verify order belongs to vendor
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('vendor_id', userId)
      .maybeSingle()

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    }

    const payload = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    // Status updates
    if (payload.status !== undefined) {
      const status = normaliseStatus(payload.status)
      if (!status) {
        return NextResponse.json({ error: 'Invalid order status.' }, { status: 400 })
      }
      updates.status = status

      // Auto-update fulfillment status based on order status
      if (status === 'shipped') {
        updates.fulfillment_status = 'shipped'
        updates.shipped_at = new Date().toISOString()
      } else if (status === 'delivered') {
        updates.fulfillment_status = 'delivered'
        updates.delivered_at = new Date().toISOString()
      } else if (status === 'cancelled') {
        updates.fulfillment_status = 'cancelled'
        updates.cancelled_at = new Date().toISOString()
        if (payload.cancelledReason) {
          updates.cancelled_reason = sanitizeText(String(payload.cancelledReason), { maxLength: 500 })
        }
      }
    }

    if (payload.paymentStatus !== undefined) {
      const paymentStatus = normalisePaymentStatus(payload.paymentStatus)
      if (!paymentStatus) {
        return NextResponse.json({ error: 'Invalid payment status.' }, { status: 400 })
      }
      updates.payment_status = paymentStatus
      if (paymentStatus === 'paid') {
        updates.paid_at = new Date().toISOString()
      }
    }

    if (payload.fulfillmentStatus !== undefined) {
      const fulfillmentStatus = normaliseFulfillmentStatus(payload.fulfillmentStatus)
      if (!fulfillmentStatus) {
        return NextResponse.json({ error: 'Invalid fulfillment status.' }, { status: 400 })
      }
      updates.fulfillment_status = fulfillmentStatus
    }

    // Tracking information
    if (payload.trackingNumber !== undefined) {
      updates.tracking_number = sanitizeText(String(payload.trackingNumber), { maxLength: 100 })
    }

    if (payload.shippingMethod !== undefined) {
      updates.shipping_method = sanitizeText(String(payload.shippingMethod), { maxLength: 100 })
    }

    if (payload.estimatedDeliveryDate !== undefined) {
      const date = new Date(payload.estimatedDeliveryDate)
      if (!isNaN(date.getTime())) {
        updates.estimated_delivery_date = date.toISOString()
      }
    }

    // Notes
    if (payload.vendorNotes !== undefined) {
      updates.vendor_notes = sanitizeText(String(payload.vendorNotes), {
        maxLength: 1000,
        allowNewlines: true,
      })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    // Update order
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .eq('vendor_id', userId)
      .select('*')
      .single<OrderRow>()

    if (updateError) {
      throw updateError
    }

    const order = mapOrderRow(updatedOrder)

    return NextResponse.json({ order })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to update order.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

