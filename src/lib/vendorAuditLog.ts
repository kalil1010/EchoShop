/**
 * Utility functions for vendor audit logging
 * Logs important vendor actions to the event_log table for security and compliance
 */

export type VendorAuditAction =
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'product_status_changed'
  | 'profile_updated'
  | 'login_success'
  | 'login_failed'
  | 'password_changed'
  | 'security_settings_updated'

interface AuditLogPayload {
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a vendor action to the audit log
 * This should be called from API routes, not client components
 */
export async function logVendorAction(
  userId: string,
  action: VendorAuditAction,
  payload?: Partial<AuditLogPayload>,
): Promise<void> {
  try {
    const eventName = `vendor_${action}`
    const fullPayload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      action,
      ...payload?.details,
    }

    if (payload?.resource) {
      fullPayload.resource = payload.resource
    }
    if (payload?.resourceId) {
      fullPayload.resourceId = payload.resourceId
    }
    if (payload?.ipAddress) {
      fullPayload.ipAddress = payload.ipAddress
    }
    if (payload?.userAgent) {
      fullPayload.userAgent = payload.userAgent
    }

    // Call the event log API
    await fetch('/api/event-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_name: eventName,
        user_id: userId,
        payload: fullPayload,
      }),
    })
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.warn('[vendorAuditLog] Failed to log action:', action, error)
  }
}

/**
 * Extract IP address and user agent from a NextRequest
 */
export function extractRequestMetadata(request: Request): {
  ipAddress?: string
  userAgent?: string
} {
  const headers = request.headers
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  const userAgent = headers.get('user-agent') || undefined

  return { ipAddress, userAgent }
}

