'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'

import type { VendorRequest, VendorRequestStatus } from '@/types/vendor'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import VendorApplicationForm from '@/components/vendor/VendorApplicationForm'
import { normaliseRole } from '@/lib/roles'

type VendorHubProps = {
  userName: string
  initialRole: string | null
  initialRequests: VendorRequest[]
}

const STATUS_STYLES: Record<VendorRequestStatus, { label: string; tone: string }> = {
  pending: { label: 'Pending', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
}

const formatRelative = (value: Date) => {
  const now = Date.now()
  const diffMs = value.getTime() - now
  const diffMinutes = Math.round(diffMs / 60000)
  if (Math.abs(diffMinutes) < 60) {
    return `${diffMinutes} minute${Math.abs(diffMinutes) === 1 ? '' : 's'} ago`
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return `${diffHours} hour${Math.abs(diffHours) === 1 ? '' : 's'} ago`
  }
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`
}

export default function VendorHub({ userName, initialRole, initialRequests }: VendorHubProps) {
  const [requests, setRequests] = useState<VendorRequest[]>(initialRequests)

  const resolvedRole = normaliseRole(initialRole)
  const isVendor = resolvedRole === 'vendor'
  const isOwner = resolvedRole === 'owner'
  const latestRequest = useMemo(() => (requests.length ? requests[0] : null), [requests])

  const handleApplicationSubmitted = (request: VendorRequest) => {
    setRequests((prev) => [request, ...prev])
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Vendor Hub</CardTitle>
          <CardDescription>
            {isVendor
              ? 'You already have vendor privileges. Jump into your portal to manage listings.'
              : isOwner
                ? 'Owner accounts manage vendor approvals from the Downtown console. Head there to review requests.'
                : 'Share a bit about your brand and the review team will follow up shortly.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Profile summary</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{userName}</span>. Your current role is{' '}
              <span className="font-medium text-foreground">{resolvedRole}</span>.
            </p>
            {isVendor ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Visit the{' '}
                <Link href="/atlas" className="text-purple-600 hover:underline">
                  vendor dashboard
                </Link>{' '}
                to upload products, manage listings, and track moderation.
              </p>
            ) : null}
            {isOwner ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Manage vendor upgrades from the{' '}
                <Link href="/downtown" className="text-purple-600 hover:underline">
                  Downtown owner console
                </Link>{' '}
                instead.
              </p>
            ) : null}
          </div>

          {resolvedRole === 'user' ? (
            latestRequest?.status === 'pending' ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                Your application is under review. We will notify you by email once a system owner approves it.
              </div>
            ) : (
              <VendorApplicationForm onSubmitted={handleApplicationSubmitted} />
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Application history</CardTitle>
          <CardDescription>
            Track the status of past submissions. Pending requests are reviewed in the order they arrive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not submitted a vendor application yet. Once you do, it will appear here.
            </p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const style = STATUS_STYLES[request.status]
                const submitted = formatRelative(new Date(request.createdAt))
                return (
                  <div key={request.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${style.tone}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-xs text-muted-foreground">Submitted {submitted}</span>
                    </div>
                    {request.message ? (
                      <div className="text-sm text-foreground whitespace-pre-wrap">{request.message}</div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No additional message included.</p>
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
