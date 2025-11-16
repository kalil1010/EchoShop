import type { Order, OrderRow, OrderItem, OrderItemRow } from '@/types/order'

export function mapOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    vendorId: row.vendor_id,
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillmentStatus: row.fulfillment_status,
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    shippingCost: Number(row.shipping_cost),
    discountAmount: Number(row.discount_amount),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone || undefined,
    shippingAddress: row.shipping_address || undefined,
    billingAddress: row.billing_address || undefined,
    shippingMethod: row.shipping_method || undefined,
    trackingNumber: row.tracking_number || undefined,
    estimatedDeliveryDate: row.estimated_delivery_date || undefined,
    shippedAt: row.shipped_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    paymentMethod: row.payment_method || undefined,
    paymentTransactionId: row.payment_transaction_id || undefined,
    paidAt: row.paid_at || undefined,
    customerNotes: row.customer_notes || undefined,
    vendorNotes: row.vendor_notes || undefined,
    internalNotes: row.internal_notes || undefined,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at || undefined,
    cancelledReason: row.cancelled_reason || undefined,
  }
}

export function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    vendorId: row.vendor_id,
    productTitle: row.product_title,
    productDescription: row.product_description || undefined,
    productImageUrl: row.product_image_url || undefined,
    productSku: row.product_sku || undefined,
    unitPrice: Number(row.unit_price),
    quantity: row.quantity,
    discountAmount: Number(row.discount_amount),
    lineTotal: Number(row.line_total),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

