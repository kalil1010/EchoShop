/**
 * Vendor Health Score Calculation Logic
 * 
 * This module provides the calculation algorithm for vendor health scores.
 * The database function handles the actual calculation, but this provides
 * client-side utilities for understanding and displaying scores.
 */

export interface VendorHealthMetrics {
  totalOrders: number
  disputeCount: number
  returnCount: number
  avgRating: number
  avgResponseTime: number
  violations: number
  paymentFailures: number
}

export interface VendorHealthScores {
  overallScore: number
  disputeScore: number
  qualityScore: number
  complianceScore: number
  responseScore: number
  paymentScore: number
}

export type VendorHealthStatus = 'excellent' | 'good' | 'warning' | 'critical'

/**
 * Calculate vendor health score from metrics
 * This mirrors the database function logic for client-side calculations
 */
export function calculateVendorHealthScore(metrics: VendorHealthMetrics): VendorHealthScores {
  // Dispute score (25% weight) - target: <5% of orders have disputes
  const disputeRate = metrics.totalOrders > 0 ? (metrics.disputeCount / metrics.totalOrders) * 100 : 0
  const disputeScore = Math.max(0, 100 - disputeRate * 20) // -20 per % dispute rate

  // Return score (20% weight) - target: <10% return rate
  const returnRate = metrics.totalOrders > 0 ? (metrics.returnCount / metrics.totalOrders) * 100 : 0
  const returnScore = Math.max(0, 100 - returnRate * 10) // -10 per % return rate

  // Quality score (25% weight) - based on customer rating
  const qualityScore = (metrics.avgRating / 5) * 100

  // Response time score (10% weight) - target: <24 hours
  const responseScore = Math.max(0, 100 - Math.min(50, (metrics.avgResponseTime / 24) * 50))

  // Compliance score (15% weight) - deduct for violations
  const complianceScore = Math.max(0, 100 - metrics.violations * 20)

  // Payment failures (5% weight)
  const paymentScore = metrics.paymentFailures > 0 ? 50 : 100

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    disputeScore * 0.25 +
    returnScore * 0.20 +
    qualityScore * 0.25 +
    responseScore * 0.10 +
    complianceScore * 0.15 +
    paymentScore * 0.05
  )

  return {
    overallScore,
    disputeScore: Math.round(disputeScore * 100) / 100,
    qualityScore: Math.round(qualityScore * 100) / 100,
    complianceScore: Math.round(complianceScore * 100) / 100,
    responseScore: Math.round(responseScore * 100) / 100,
    paymentScore: Math.round(paymentScore * 100) / 100,
  }
}

/**
 * Determine health status from overall score
 */
export function getHealthStatus(overallScore: number): VendorHealthStatus {
  if (overallScore >= 90) return 'excellent'
  if (overallScore >= 75) return 'good'
  if (overallScore >= 50) return 'warning'
  return 'critical'
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: VendorHealthStatus): string {
  switch (status) {
    case 'excellent':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'good':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'warning':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
  }
}

/**
 * Get status icon name (for lucide-react)
 */
export function getStatusIcon(status: VendorHealthStatus): string {
  switch (status) {
    case 'excellent':
      return 'CheckCircle2'
    case 'good':
      return 'CheckCircle'
    case 'warning':
      return 'AlertTriangle'
    case 'critical':
      return 'AlertCircle'
  }
}

