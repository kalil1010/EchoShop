/**
 * Payment Gateway Abstraction Layer
 * 
 * This module provides a unified interface for payment gateway operations.
 * Currently supports placeholder implementation, ready for Kashier integration.
 */

export interface PaymentGatewayConfig {
  apiKey: string
  merchantId: string
  environment: 'sandbox' | 'production'
  webhookSecret?: string
}

export interface PayoutRequest {
  amount: number
  currency: string
  recipientId: string
  recipientType: 'bank_account' | 'wallet' | 'card'
  recipientDetails: Record<string, unknown>
  description?: string
  metadata?: Record<string, unknown>
}

export interface PayoutResponse {
  success: boolean
  transactionId?: string
  payoutId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  fees?: number
}

export interface PaymentGateway {
  /**
   * Initialize the payment gateway with configuration
   */
  initialize(config: PaymentGatewayConfig): Promise<void>

  /**
   * Process a payout to a vendor
   */
  processPayout(request: PayoutRequest): Promise<PayoutResponse>

  /**
   * Get payout status
   */
  getPayoutStatus(payoutId: string): Promise<PayoutResponse>

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean

  /**
   * Handle webhook event
   */
  handleWebhook(event: unknown): Promise<void>
}

/**
 * Base payment gateway implementation
 * This is a placeholder that will be extended by specific gateway implementations
 */
export abstract class BasePaymentGateway implements PaymentGateway {
  protected config: PaymentGatewayConfig | null = null

  async initialize(config: PaymentGatewayConfig): Promise<void> {
    this.config = config
  }

  abstract processPayout(request: PayoutRequest): Promise<PayoutResponse>
  abstract getPayoutStatus(payoutId: string): Promise<PayoutResponse>
  abstract verifyWebhook(payload: string, signature: string): boolean
  abstract handleWebhook(event: unknown): Promise<void>
}

/**
 * Payment gateway factory
 * Returns the appropriate gateway implementation based on configuration
 */
export function createPaymentGateway(type: 'kashier' | 'stripe' | 'paypal'): PaymentGateway {
  switch (type) {
    case 'kashier':
      // Will be implemented when Kashier integration is ready
      // return new KashierGateway()
      throw new Error('Kashier gateway not yet implemented')
    case 'stripe':
      throw new Error('Stripe gateway not yet implemented')
    case 'paypal':
      throw new Error('PayPal gateway not yet implemented')
    default:
      throw new Error(`Unknown payment gateway type: ${type}`)
  }
}

/**
 * Get payment gateway instance from environment
 */
export function getPaymentGateway(): PaymentGateway | null {
  const gatewayType = process.env.PAYMENT_GATEWAY_TYPE as 'kashier' | 'stripe' | 'paypal' | undefined
  
  if (!gatewayType) {
    return null
  }

  try {
    return createPaymentGateway(gatewayType)
  } catch (error) {
    console.error('Failed to create payment gateway:', error)
    return null
  }
}

