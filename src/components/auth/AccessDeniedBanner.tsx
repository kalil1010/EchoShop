'use client'

import React from 'react'
import Link from 'next/link'
import { AlertCircle, Shield, Store, User, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PortalNotice } from '@/lib/roles'

interface AccessDeniedBannerProps {
  notice: PortalNotice
  onDismiss?: () => void
  dismissible?: boolean
}

const toneStyles = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  success: 'bg-green-50 border-green-200 text-green-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  danger: 'bg-red-50 border-red-200 text-red-900',
}

const toneIcons = {
  info: AlertCircle,
  success: AlertCircle,
  warning: AlertCircle,
  danger: Shield,
}

export function AccessDeniedBanner({ notice, onDismiss, dismissible = false }: AccessDeniedBannerProps) {
  const Icon = toneIcons[notice.tone]
  const styles = toneStyles[notice.tone]

  return (
    <div className={`rounded-lg border p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm mb-1">{notice.title}</h3>
          <p className="text-sm opacity-90 mb-2">{notice.description}</p>
          {notice.helperText && (
            <p className="text-xs opacity-75 mb-2">{notice.helperText}</p>
          )}
          {notice.actionHref && notice.actionLabel && (
            <Link href={notice.actionHref}>
              <Button
                size="sm"
                variant={notice.tone === 'danger' ? 'destructive' : 'default'}
                className="mt-2"
              >
                {notice.actionLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

