/**
 * Utility functions for creating vendor notifications
 * Used by backend services to notify vendors of events
 */

import { createServiceClient } from './supabaseServer'

export type NotificationType = 'moderation' | 'order' | 'payout' | 'message' | 'system'

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  link?: string | null
  metadata?: Record<string, unknown> | null
  expiresAt?: Date | null
}

/**
 * Create a notification for a vendor
 * This function uses the service client to bypass RLS
 */
export async function createVendorNotification(params: CreateNotificationParams): Promise<string | null> {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('vendor_notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
        metadata: params.metadata || null,
        expires_at: params.expiresAt ? params.expiresAt.toISOString() : null,
        is_read: false,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create notification:', error)
      return null
    }

    return data.id
  } catch (error) {
    console.error('Error creating notification:', error)
    return null
  }
}

/**
 * Create a moderation notification
 */
export async function notifyProductModeration(
  userId: string,
  productId: string,
  productTitle: string,
  status: 'active' | 'rejected' | 'pending_review',
  moderationMessage?: string | null,
): Promise<void> {
  let title: string
  let message: string

  switch (status) {
    case 'active':
      title = 'Product Approved'
      message = `Your product "${productTitle}" has been approved and is now live!`
      break
    case 'rejected':
      title = 'Product Rejected'
      message = `Your product "${productTitle}" was rejected. ${moderationMessage || 'Please review and resubmit.'}`
      break
    case 'pending_review':
      title = 'Product Under Review'
      message = `Your product "${productTitle}" is now under review.`
      break
  }

  await createVendorNotification({
    userId,
    type: 'moderation',
    title,
    message,
    link: `/atlas/products?highlight=${productId}`,
    metadata: {
      product_id: productId,
      status,
    },
  })
}

/**
 * Create an order notification
 */
export async function notifyOrderUpdate(
  userId: string,
  orderId: string,
  orderNumber: string,
  status: string,
): Promise<void> {
  await createVendorNotification({
    userId,
    type: 'order',
    title: 'Order Update',
    message: `Order #${orderNumber} status changed to ${status}.`,
    link: `/atlas/orders?highlight=${orderId}`,
    metadata: {
      order_id: orderId,
      order_number: orderNumber,
      status,
    },
  })
}

/**
 * Create a payout notification
 */
export async function notifyPayoutReminder(
  userId: string,
  amount: number,
  payoutDate: Date,
): Promise<void> {
  await createVendorNotification({
    userId,
    type: 'payout',
    title: 'Payout Reminder',
    message: `Your payout of ${amount.toFixed(2)} EGP is scheduled for ${payoutDate.toLocaleDateString()}.`,
    link: '/atlas',
    metadata: {
      amount,
      payout_date: payoutDate.toISOString(),
    },
    expiresAt: payoutDate,
  })
}

/**
 * Create a support ticket notification
 */
export async function notifyNewSupportTicket(
  userId: string,
  ticketSubject: string,
  ticketPriority: string,
): Promise<void> {
  await createVendorNotification({
    userId,
    type: 'message',
    title: 'New Support Ticket',
    message: `Your ticket "${ticketSubject}" has been created with ${ticketPriority} priority.`,
    link: '/atlas?tab=support',
    metadata: {
      ticket_subject: ticketSubject,
      ticket_priority: ticketPriority,
    },
  })
}

/**
 * Create a message notification (for ticket replies)
 */
export async function notifyNewMessage(
  userId: string,
  senderName: string,
  messagePreview: string,
): Promise<void> {
  await createVendorNotification({
    userId,
    type: 'message',
    title: 'New Message',
    message: `${senderName}: ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}`,
    link: '/atlas?tab=support',
    metadata: {
      sender_name: senderName,
    },
  })
}

