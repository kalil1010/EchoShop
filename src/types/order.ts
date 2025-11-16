export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

export interface ShippingAddress {
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  state?: string
  postalCode: string
  country: string
  phone?: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  vendorId: string
  productTitle: string
  productDescription?: string
  productImageUrl?: string
  productSku?: string
  unitPrice: number
  quantity: number
  discountAmount: number
  lineTotal: number
  currency: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  vendorId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  subtotal: number
  taxAmount: number
  shippingCost: number
  discountAmount: number
  totalAmount: number
  currency: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  shippingAddress?: ShippingAddress
  billingAddress?: ShippingAddress
  shippingMethod?: string
  trackingNumber?: string
  estimatedDeliveryDate?: string
  shippedAt?: string
  deliveredAt?: string
  paymentMethod?: string
  paymentTransactionId?: string
  paidAt?: string
  customerNotes?: string
  vendorNotes?: string
  internalNotes?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  cancelledAt?: string
  cancelledReason?: string
  items?: OrderItem[]
}

export interface OrderRow {
  id: string
  order_number: string
  customer_id: string
  vendor_id: string
  status: OrderStatus
  payment_status: PaymentStatus
  fulfillment_status: FulfillmentStatus
  subtotal: number
  tax_amount: number
  shipping_cost: number
  discount_amount: number
  total_amount: number
  currency: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  shipping_address: ShippingAddress | null
  billing_address: ShippingAddress | null
  shipping_method: string | null
  tracking_number: string | null
  estimated_delivery_date: string | null
  shipped_at: string | null
  delivered_at: string | null
  payment_method: string | null
  payment_transaction_id: string | null
  paid_at: string | null
  customer_notes: string | null
  vendor_notes: string | null
  internal_notes: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  cancelled_at: string | null
  cancelled_reason: string | null
}

export interface OrderItemRow {
  id: string
  order_id: string
  product_id: string
  vendor_id: string
  product_title: string
  product_description: string | null
  product_image_url: string | null
  product_sku: string | null
  unit_price: number
  quantity: number
  discount_amount: number
  line_total: number
  currency: string
  status: OrderStatus
  created_at: string
  updated_at: string
}

