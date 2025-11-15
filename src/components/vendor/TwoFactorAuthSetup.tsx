'use client'

import React, { useState, useEffect } from 'react'
import { X, Copy, CheckCircle2, Loader2, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

interface TwoFactorAuthSetupProps {
  onComplete: () => void
  onCancel: () => void
}

export default function TwoFactorAuthSetup({ onComplete, onCancel }: TwoFactorAuthSetupProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<'setup' | 'verify'>('setup')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Initialize 2FA setup
    const initialize2FA = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/vendor/security/2fa/setup', {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to initialize 2FA setup')
        }

        const data = await response.json()
        setQrCode(data.qrCode)
        setSecret(data.secret)
      } catch (error) {
        toast({
          variant: 'error',
          title: 'Setup failed',
          description: error instanceof Error ? error.message : 'Failed to initialize 2FA setup.',
        })
        onCancel()
      } finally {
        setLoading(false)
      }
    }

    initialize2FA()
  }, [onCancel, toast])

  const handleCopySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({
        variant: 'success',
        title: 'Copied',
        description: 'Recovery code copied to clipboard.',
      })
    }
  }

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast({
        variant: 'error',
        title: 'Invalid code',
        description: 'Please enter a 6-digit verification code.',
      })
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/vendor/security/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode, secret }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Verification failed')
      }

      onComplete()
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Verification failed',
        description: error instanceof Error ? error.message : 'Invalid verification code. Please try again.',
      })
      setVerificationCode('')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Set Up Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              {step === 'setup'
                ? 'Scan the QR code with your authenticator app to get started.'
                : 'Enter the verification code from your authenticator app.'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : step === 'setup' ? (
            <>
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  {qrCode && (
                    <div className="rounded-lg border-2 border-emerald-200 p-4 bg-white">
                      <img src={qrCode} alt="QR Code for 2FA setup" className="w-64 h-64" />
                    </div>
                  )}
                  <p className="text-sm text-center text-muted-foreground max-w-md">
                    Scan this QR code with an authenticator app like Google Authenticator, Authy, or Microsoft
                    Authenticator.
                  </p>
                </div>

                {secret && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Manual Entry Code</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={secret}
                        readOnly
                        className="font-mono text-sm"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button variant="outline" size="icon" onClick={handleCopySecret}>
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      If you can&apos;t scan the QR code, enter this code manually in your authenticator app.
                    </p>
                  </div>
                )}

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-900 mb-2">Don&apos;t have an authenticator app?</p>
                  <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                    <li>Download Google Authenticator (iOS/Android)</li>
                    <li>Download Authy (iOS/Android/Desktop)</li>
                    <li>Download Microsoft Authenticator (iOS/Android)</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('verify')}>I&apos;ve scanned the code</Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app to verify the setup.
                </p>
                <div>
                  <label htmlFor="verification-code" className="text-sm font-medium mb-2 block">
                    Verification Code
                  </label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      setVerificationCode(value)
                    }}
                    placeholder="000000"
                    className="text-center text-2xl font-mono tracking-widest"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setStep('setup')}>
                  Back
                </Button>
                <Button onClick={handleVerify} disabled={verifying || verificationCode.length !== 6}>
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

