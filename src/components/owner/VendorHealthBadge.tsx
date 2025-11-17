'use client'

import React from 'react'
import { CheckCircle2, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusColor, getStatusIcon, type VendorHealthStatus } from '@/lib/vendorHealthCalculation'

interface VendorHealthBadgeProps {
  score: number
  status: VendorHealthStatus
  className?: string
  showLabel?: boolean
}

const iconMap = {
  CheckCircle2,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
}

export function VendorHealthBadge({ score, status, className, showLabel = true }: VendorHealthBadgeProps) {
  const iconName = getStatusIcon(status)
  const Icon = iconMap[iconName as keyof typeof iconMap] || CheckCircle
  const colorClasses = getStatusColor(status)

  return (
    <div className={cn('flex items-center gap-2 rounded-md border px-2 py-1', colorClasses, className)}>
      <Icon className="h-4 w-4" />
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold">{score}/100</span>
        {showLabel && (
          <span className="text-xs capitalize opacity-80">{status}</span>
        )}
      </div>
    </div>
  )
}

