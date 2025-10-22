'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'

import type { VendorRequest, VendorRequestStatus } from '@/types/vendor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type VendorHubProps = {
  userName: string
  initialRole: string | null
  initialRequests: VendorRequest[]
}

const STATUS_LABELS: Record<VendorRequestStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const MAX_MESSAGE_LENGTH = 800

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const formatRelativeTime = (value: Date) => {
  const now = Date.now()
  const diffMs = value.getTime() - now
  const diffMinutes = Math.round(diffMs / 60000)
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute')
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour')
  }
  const diffDays = Math.round(diffHours / 24)
  return rtf.format(diffDays, 'day')
}

export default function VendorHub({ userName, initialRole, initialRequests }: VendorHubProps) {
  const { toast } = useToast()
  const [requests, setRequests] = useState<VendorRequest[]>(initialRequests)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const normalizedRole = initialRole?.toLowerCase() ?? 'user'
  const latestRequest = useMemo(() => (requests.length ? requests[0] : null), [requests])
  const canSubmitRequest = normalizedRole === 'user' && (latestRequest?.status !== 'pending')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmitRequest) return

    const trimmedMessage = message.trim()
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast({
        variant: 'error',
        title: 'Application message too long',
        description: `Please keep your notes under ${MAX_MESSAGE_LENGTH} characters.`,
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/vendor/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmedMessage || undefined }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const description =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to submit your vendor application right now.'
        throw new Error(description)
      }

      const payload = await response.json()
      if (payload?.request) {
        setRequests((prev) => [payload.request as VendorRequest, ...prev])
        setMessage('')
      }

      toast({
        variant: 'success',
        title: 'Vendor application submitted',
        description: 'A system owner will review your request shortly.',
      })
    } catch (error) {
      const description =
        error instanceof Error ? error.message : 'Unexpected error submitting vendor request.'
      toast({ variant: 'error', title: 'Request failed', description })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Vendor Hub</CardTitle>
          <CardDescription>
            {normalizedRole === 'vendor' || normalizedRole === 'admin'
              ? 'Your account already has vendor privileges. Access the portal from the navigation bar.'
              : 'Share a little about your brand and we’ll review your request.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Profile summary</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Signed in as <span className="font-medium text-foreground">{userName}</span>. Your current role is{' '}
              <span className="font-medium text-foreground">{normalizedRole}</span>.
            </p>
            {normalizedRole === 'vendor' || normalizedRole === 'admin' ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Visit the{' '}
                <Link href="/dashboard/vendor" className="text-purple-600 hover:underline">
                  Vendor Portal
                </Link>{' '}
                to upload products, manage listings, and track approvals.
              </p>
            ) : null}
          </div>

          {normalizedRole === 'user' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="vendor-message" className="text-sm font-medium text-foreground">
                  Tell us about your brand <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="vendor-message"
                  placeholder="Share what you sell, your website, or anything else the review team should know."
                  maxLength={MAX_MESSAGE_LENGTH}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </p>
              </div>
              <Button type="submit" disabled={!canSubmitRequest || submitting} className="w-full sm:w-auto">
                {submitting ? 'Submitting…' : 'Submit vendor application'}
              </Button>
              <p className="text-xs text-muted-foreground">
                After submitting, a system owner will review your request. You’ll be notified once approved.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application history</CardTitle>
          <CardDescription>
            Track the status of past submissions. Pending requests will be reviewed in the order they are received.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven’t submitted a vendor application yet. When you do, it will show up here.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const statusBadge = STATUS_LABELS[request.status]
                const submittedAgo = formatRelativeTime(new Date(request.createdAt))
                return (
                  <div key={request.id} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusBadge.tone}`}
                      >
                        {statusBadge.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Submitted {submittedAgo}</span>
                    </div>
                    {request.message ? (
                      <div className="text-sm text-foreground whitespace-pre-wrap">{request.message}</div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No additional message provided.</p>
                    )}
                    {request.adminNotes ? (
                      <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Reviewer notes: </span>
                        {request.adminNotes}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
