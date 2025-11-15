/**
 * 2FA utilities for checking requirements and managing verification sessions
 */

import { createServiceClient } from '@/lib/supabaseServer'
import type { UserRole } from '@/types/user'

export type CriticalActionType =
  | 'delete_product'
  | 'delete_account'
  | 'change_role'
  | 'payout_request'
  | 'bulk_delete'
  | 'modify_pricing'
  | 'export_data'
  | 'admin_action'

export interface TwoFactorSession {
  id: string
  userId: string
  sessionToken: string
  purpose: 'login' | 'critical_action'
  actionType?: string
  actionContext?: Record<string, unknown>
  verified: boolean
  expiresAt: string
  createdAt: string
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('user_security_settings')
    .select('two_factor_enabled')
    .eq('user_id', userId)
    .maybeSingle<{ two_factor_enabled: boolean }>()

  if (error) {
    console.warn('[2FA] Failed to check 2FA status:', error)
    return false
  }

  return data?.two_factor_enabled ?? false
}

/**
 * Check if 2FA is required for a user role and action
 */
export function is2FARequired(
  userRole: UserRole | null | undefined,
  purpose: 'login' | 'critical_action',
  actionType?: CriticalActionType,
): boolean {
  if (!userRole) return false

  // Owner: 2FA required for all logins AND critical actions
  if (userRole === 'owner' || userRole === 'admin') {
    if (purpose === 'login') return true
    if (purpose === 'critical_action') return true
  }

  // Vendor: 2FA required for critical actions only
  if (userRole === 'vendor') {
    if (purpose === 'critical_action') return true
    if (purpose === 'login') return false // Vendors don't need 2FA for login
  }

  // User: 2FA required for critical actions only
  if (userRole === 'user') {
    if (purpose === 'critical_action') return true
    if (purpose === 'login') return false // Users don't need 2FA for login
  }

  return false
}

/**
 * Create a 2FA verification session
 */
export async function create2FASession(
  userId: string,
  purpose: 'login' | 'critical_action',
  actionType?: CriticalActionType,
  actionContext?: Record<string, unknown>,
): Promise<TwoFactorSession | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('two_factor_sessions')
    .insert({
      user_id: userId,
      purpose,
      action_type: actionType || null,
      action_context: actionContext || null,
      verified: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    })
    .select('*')
    .single<TwoFactorSession>()

  if (error) {
    console.error('[2FA] Failed to create session:', error)
    return null
  }

  return data
}

/**
 * Verify a 2FA session token
 */
export async function verify2FASession(sessionToken: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('two_factor_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('verified', false)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<TwoFactorSession>()

  if (error || !data) {
    return false
  }

  // Mark as verified
  const { error: updateError } = await supabase
    .from('two_factor_sessions')
    .update({ verified: true })
    .eq('id', data.id)

  return !updateError
}

/**
 * Get 2FA session by token
 */
export async function get2FASession(sessionToken: string): Promise<TwoFactorSession | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('two_factor_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .maybeSingle<TwoFactorSession>()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Clean up expired 2FA sessions
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('two_factor_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
}

