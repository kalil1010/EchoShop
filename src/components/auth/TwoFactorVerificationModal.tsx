'use client'

import React, { useState } from 'react'
import { Shield, X, Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface TwoFactorVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  onVerify: (code: string, backupCode?: string) => Promise<void>
  purpose: 'login' | 'critical_action'
  actionType?: string
  loading?: boolean
}

export default function TwoFactorVerificationModal({
  isOpen,
  onClose,
  onVerify,
  purpose,
  actionType,
  loading = false,
}: TwoFactorVerificationModalProps) {
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [verifying, setVerifying] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const verificationCode = useBackupCode ? backupCode : code
    if (!verificationCode || (useBackupCode ? verificationCode.length !== 8 : verificationCode.length !== 6)) {
      toast({
        variant: 'error',
        title: 'Invalid code',
        description: useBackupCode
          ? 'Please enter an 8-digit backup code.'
          : 'Please enter a 6-digit verification code.',
      })
      return
    }

    setVerifying(true)
    try {
      await onVerify(useBackupCode ? '' : code, useBackupCode ? backupCode : undefined)
      setCode('')
      setBackupCode('')
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Verification failed',
        description: error instanceof Error ? error.message : 'Invalid code. Please try again.',
      })
    } finally {
      setVerifying(false)
    }
  }

  const title = purpose === 'login' ? 'Two-Factor Authentication' : 'Verify Your Identity'
  const description =
    purpose === 'login'
      ? 'Enter the 6-digit code from your authenticator app to complete login.'
      : `This action requires 2FA verification. Enter the 6-digit code from your authenticator app${actionType ? ` to ${actionType.replace(/_/g, ' ')}` : ''}.`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={verifying}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!useBackupCode ? (
              <div>
                <label htmlFor="code" className="text-sm font-medium mb-2 block">
                  Verification Code
                </label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setCode(value)
                  }}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest"
                  autoFocus
                  disabled={verifying || loading}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            ) : (
              <div>
                <label htmlFor="backup-code" className="text-sm font-medium mb-2 block">
                  Backup Code
                </label>
                <Input
                  id="backup-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{8}"
                  maxLength={8}
                  value={backupCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setBackupCode(value)
                  }}
                  placeholder="00000000"
                  className="text-center text-xl font-mono tracking-widest"
                  autoFocus
                  disabled={verifying || loading}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter an 8-digit backup code if you don't have access to your authenticator app
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode)
                  setCode('')
                  setBackupCode('')
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700"
                disabled={verifying || loading}
              >
                {useBackupCode ? 'Use authenticator code' : 'Use backup code'}
              </button>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  {purpose === 'login'
                    ? 'After 5 failed attempts, your account will be temporarily locked for 30 minutes.'
                    : 'This is a sensitive action. Make sure you trust this request.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={verifying || loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifying || loading || (!code && !backupCode)}>
                {verifying || loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

