'use client'

import React from 'react'
import Link from 'next/link'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface SessionExpiredBannerProps {
  onRetry?: () => void
}

export function SessionExpiredBanner({ onRetry }: SessionExpiredBannerProps) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <AlertCircle className="h-5 w-5" />
          Session Expired
        </CardTitle>
        <CardDescription className="text-amber-700">
          Your session has expired. Please sign in again to continue.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-3">
        <Link href="/auth">
          <Button variant="default" className="w-full sm:w-auto">
            Sign In Again
          </Button>
        </Link>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="w-full sm:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

