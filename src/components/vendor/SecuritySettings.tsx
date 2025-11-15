'use client'

import React, { useState, useEffect } from 'react'
import { Shield, Key, Activity, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'
import TwoFactorAuthSetup from './TwoFactorAuthSetup'
import AuditLogViewer from './AuditLogViewer'

export default function SecuritySettings() {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [show2FASetup, setShow2FASetup] = useState(false)

  useEffect(() => {
    // Check 2FA status
    const check2FAStatus = async () => {
      try {
        const response = await fetch('/api/vendor/security/2fa/status', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          setTwoFactorEnabled(data.enabled ?? false)
        }
      } catch (error) {
        console.warn('Failed to check 2FA status:', error)
      } finally {
        setLoading(false)
      }
    }

    check2FAStatus()
  }, [])

  const handle2FAToggle = async () => {
    if (twoFactorEnabled) {
      // Disable 2FA
      const confirmed = window.confirm(
        'Are you sure you want to disable two-factor authentication? This will reduce your account security.',
      )
      if (!confirmed) return

      setLoading(true)
      try {
        const response = await fetch('/api/vendor/security/2fa/disable', {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to disable 2FA')
        }

        setTwoFactorEnabled(false)
        toast({
          variant: 'success',
          title: '2FA disabled',
          description: 'Two-factor authentication has been disabled for your account.',
        })
      } catch (error) {
        toast({
          variant: 'error',
          title: 'Failed to disable 2FA',
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setLoading(false)
      }
    } else {
      // Enable 2FA - show setup modal
      setShow2FASetup(true)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Security Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account security, two-factor authentication, and view activity logs.
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account by requiring a code from your phone when you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking status...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {twoFactorEnabled ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is disabled'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorEnabled
                        ? 'Your account is protected with an additional security layer.'
                        : 'Enable 2FA to add an extra layer of security to your account.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={twoFactorEnabled ? 'outline' : 'default'}
                  onClick={handle2FAToggle}
                  disabled={loading}
                >
                  {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
          <AuditLogViewer vendorId={userProfile?.uid} />
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
              <span>Enable two-factor authentication for added security</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Review your activity log regularly for suspicious activity</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Never share your authentication codes with anyone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">✓</span>
              <span>Log out from shared or public devices</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <TwoFactorAuthSetup
          onComplete={() => {
            setTwoFactorEnabled(true)
            setShow2FASetup(false)
            toast({
              variant: 'success',
              title: '2FA enabled',
              description: 'Two-factor authentication has been successfully enabled for your account.',
            })
          }}
          onCancel={() => setShow2FASetup(false)}
        />
      )}
    </div>
  )
}

