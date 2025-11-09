'use client'

import React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function OrderManagement() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-800">
          Order management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>
          Order tracking will appear here once marketplace checkout is connected to vendor
          storefronts. You&apos;ll be able to monitor purchases, update fulfillment status, and
          communicate with customers.
        </p>
        <p className="text-xs text-slate-500">
          This module is currently in planning. If you need manual support in the meantime, reach out
          to the Echo Shop team and we&apos;ll help coordinate order logistics for you.
        </p>
      </CardContent>
    </Card>
  )
}
