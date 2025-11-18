'use client'

import React from 'react'
import { Key, Activity } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import AuditLogViewer from '@/components/vendor/AuditLogViewer'

export default function OwnerSecuritySettings() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account security and view activity logs.
        </p>
      </div>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle>Activity Log</CardTitle>
          </div>
          <CardDescription>
            View recent security events and account activity. This helps you monitor your account for suspicious activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogViewer vendorId={user?.uid} apiPrefix="/api/admin" />
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-600" />
            <CardTitle>Security Best Practices</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Use a strong, unique password for your account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Review your activity log regularly for suspicious activity</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Log out from shared or public devices</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Use unique passwords for different services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Be cautious with email links and attachments</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

