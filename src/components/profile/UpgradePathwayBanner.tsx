'use client'

import React from 'react'
import Link from 'next/link'
import { Store, Shield, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function UpgradePathwayBanner() {
  const { userProfile } = useAuth()
  const role = userProfile?.role ?? 'user'

  // Only show for regular users
  if (role !== 'user') {
    return null
  }

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-purple-600" />
          Unlock More Features
        </CardTitle>
        <CardDescription>
          Upgrade your account to access additional tools and capabilities.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-slate-900">Become a Vendor</h3>
              <p className="text-sm text-slate-600 mt-1">
                Sell products on the marketplace, manage listings, and reach customers directly.
              </p>
              <Link href="/vendor/hub">
                <Button size="sm" variant="outline" className="mt-2">
                  Request Vendor Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="pt-3 border-t border-purple-200">
          <p className="text-xs text-slate-500">
            Need owner/admin access? Contact support for elevated privileges.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

