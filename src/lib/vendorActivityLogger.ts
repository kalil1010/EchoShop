/**
 * Vendor Activity Logger
 * 
 * Centralized utility for logging vendor activities
 */

interface ActivityMetadata {
  [key: string]: unknown
}

interface LogActivityParams {
  vendorId: string
  actionType: string
  actionCategory: 'product' | 'order' | 'profile' | 'payment' | 'other'
  description: string
  relatedEntityType?: string
  relatedEntityId?: string
  metadata?: ActivityMetadata
  ipAddress?: string
  userAgent?: string
}

/**
 * Log vendor activity to the database
 */
export async function logVendorActivity(params: LogActivityParams): Promise<void> {
  try {
    const response = await fetch('/api/admin/activity-feed/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      console.error('Failed to log vendor activity:', await response.text())
    }
  } catch (error) {
    console.error('Error logging vendor activity:', error)
    // Don't throw - activity logging should not break the main flow
  }
}

/**
 * Helper functions for common activity types
 */
export const ActivityLogger = {
  productUpload: (vendorId: string, productId: string, productTitle: string) =>
    logVendorActivity({
      vendorId,
      actionType: 'product_upload',
      actionCategory: 'product',
      description: `Uploaded product: ${productTitle}`,
      relatedEntityType: 'product',
      relatedEntityId: productId,
      metadata: { product_title: productTitle },
    }),

  productUpdate: (vendorId: string, productId: string, changes: Record<string, unknown>) =>
    logVendorActivity({
      vendorId,
      actionType: 'product_update',
      actionCategory: 'product',
      description: `Updated product: ${productId}`,
      relatedEntityType: 'product',
      relatedEntityId: productId,
      metadata: { changes },
    }),

  productDelete: (vendorId: string, productId: string, productTitle: string) =>
    logVendorActivity({
      vendorId,
      actionType: 'product_delete',
      actionCategory: 'product',
      description: `Deleted product: ${productTitle}`,
      relatedEntityType: 'product',
      relatedEntityId: productId,
      metadata: { product_title: productTitle },
    }),

  bulkProductAction: (vendorId: string, action: string, count: number) =>
    logVendorActivity({
      vendorId,
      actionType: 'bulk_product_action',
      actionCategory: 'product',
      description: `Bulk ${action}: ${count} products`,
      metadata: { action, count },
    }),

  priceChange: (vendorId: string, productId: string, oldPrice: number, newPrice: number) =>
    logVendorActivity({
      vendorId,
      actionType: 'price_change',
      actionCategory: 'product',
      description: `Changed price from ${oldPrice} to ${newPrice}`,
      relatedEntityType: 'product',
      relatedEntityId: productId,
      metadata: { old_price: oldPrice, new_price: newPrice },
    }),

  orderUpdate: (vendorId: string, orderId: string, status: string) =>
    logVendorActivity({
      vendorId,
      actionType: 'order_update',
      actionCategory: 'order',
      description: `Updated order status to: ${status}`,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
      metadata: { status },
    }),

  profileUpdate: (vendorId: string, changes: Record<string, unknown>) =>
    logVendorActivity({
      vendorId,
      actionType: 'profile_update',
      actionCategory: 'profile',
      description: 'Updated business profile',
      relatedEntityType: 'profile',
      relatedEntityId: vendorId,
      metadata: { changes },
    }),

  payoutRequest: (vendorId: string, payoutId: string, amount: number) =>
    logVendorActivity({
      vendorId,
      actionType: 'payout_request',
      actionCategory: 'payment',
      description: `Requested payout: ${amount}`,
      relatedEntityType: 'payout',
      relatedEntityId: payoutId,
      metadata: { amount },
    }),
}

