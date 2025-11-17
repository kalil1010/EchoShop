/**
 * Audit Logger
 * 
 * Centralized utility for logging all admin actions for GDPR compliance
 */

interface AuditMetadata {
  [key: string]: unknown
}

interface LogAuditParams {
  adminId: string
  actionType: string
  actionCategory: 'user' | 'vendor' | 'product' | 'payout' | 'system' | 'other'
  description: string
  reason?: string
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  targetEntityType?: string
  targetEntityId?: string
  metadata?: AuditMetadata
  retentionDays?: number
}

/**
 * Log admin action to audit log
 * This should be called for all admin actions
 */
export async function logAuditAction(params: LogAuditParams): Promise<void> {
  try {
    // Get IP address and user agent from browser if available
    const ipAddress = typeof window !== 'undefined' 
      ? undefined // Will be captured server-side
      : undefined

    const response = await fetch('/api/admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      console.error('Failed to log audit action:', await response.text())
    }
  } catch (error) {
    console.error('Error logging audit action:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Helper functions for common audit actions
 */
export const AuditLogger = {
  userRoleChange: (
    adminId: string,
    userId: string,
    oldRole: string,
    newRole: string,
    reason?: string
  ) =>
    logAuditAction({
      adminId,
      actionType: 'user_role_change',
      actionCategory: 'user',
      description: `Changed user role from ${oldRole} to ${newRole}`,
      reason,
      beforeState: { role: oldRole },
      afterState: { role: newRole },
      targetEntityType: 'user',
      targetEntityId: userId,
    }),

  vendorSuspend: (adminId: string, vendorId: string, reason?: string) =>
    logAuditAction({
      adminId,
      actionType: 'vendor_suspend',
      actionCategory: 'vendor',
      description: `Suspended vendor: ${vendorId}`,
      reason,
      targetEntityType: 'vendor',
      targetEntityId: vendorId,
    }),

  vendorUnsuspend: (adminId: string, vendorId: string, reason?: string) =>
    logAuditAction({
      adminId,
      actionType: 'vendor_unsuspend',
      actionCategory: 'vendor',
      description: `Unsuspended vendor: ${vendorId}`,
      reason,
      targetEntityType: 'vendor',
      targetEntityId: vendorId,
    }),

  payoutHold: (adminId: string, payoutId: string, reason: string) =>
    logAuditAction({
      adminId,
      actionType: 'payout_hold',
      actionCategory: 'payout',
      description: `Held payout: ${payoutId}`,
      reason,
      targetEntityType: 'payout',
      targetEntityId: payoutId,
    }),

  payoutRelease: (adminId: string, payoutId: string, reason?: string) =>
    logAuditAction({
      adminId,
      actionType: 'payout_release',
      actionCategory: 'payout',
      description: `Released payout: ${payoutId}`,
      reason,
      targetEntityType: 'payout',
      targetEntityId: payoutId,
    }),

  productApprove: (adminId: string, productId: string) =>
    logAuditAction({
      adminId,
      actionType: 'product_approve',
      actionCategory: 'product',
      description: `Approved product: ${productId}`,
      targetEntityType: 'product',
      targetEntityId: productId,
    }),

  productReject: (adminId: string, productId: string, reason: string) =>
    logAuditAction({
      adminId,
      actionType: 'product_reject',
      actionCategory: 'product',
      description: `Rejected product: ${productId}`,
      reason,
      targetEntityType: 'product',
      targetEntityId: productId,
    }),

  bulkAction: (
    adminId: string,
    actionType: string,
    category: LogAuditParams['actionCategory'],
    count: number,
    targetIds: string[]
  ) =>
    logAuditAction({
      adminId,
      actionType: `bulk_${actionType}`,
      actionCategory: category,
      description: `Bulk ${actionType}: ${count} items`,
      metadata: { count, target_ids: targetIds },
    }),

  systemConfigChange: (
    adminId: string,
    configKey: string,
    oldValue: unknown,
    newValue: unknown
  ) =>
    logAuditAction({
      adminId,
      actionType: 'system_config_change',
      actionCategory: 'system',
      description: `Changed system config: ${configKey}`,
      beforeState: { [configKey]: oldValue },
      afterState: { [configKey]: newValue },
      metadata: { config_key: configKey },
    }),
}

