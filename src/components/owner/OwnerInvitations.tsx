'use client'

import React, { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import type { OwnerInvitationRecord } from './types'

const statusTone: Record<string, string> = {
  pending: 'text-amber-600',
  accepted: 'text-emerald-600',
  expired: 'text-slate-500',
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString()
}

export default function OwnerInvitations() {
  const { toast } = useToast()
  const [invitations, setInvitations] = useState<OwnerInvitationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingRequest, setPendingRequest] = useState(false)
  const [email, setEmail] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(7)

  const fetchInvitations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/owner/invitations', { credentials: 'include' })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load invitations.')
      }
      const payload = await response.json()
      const list: OwnerInvitationRecord[] = Array.isArray(payload?.invitations) ? payload.invitations : []
      setInvitations(list)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load invitations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvitations()
  }, [fetchInvitations])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pendingRequest) return

    setPendingRequest(true)
    try {
      const response = await fetch('/api/owner/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, expiresInDays }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to send invitation.')
      }
      setEmail('')
      setExpiresInDays(7)
      toast({
        title: 'Invitation sent',
        description: 'The owner invitation email has been generated successfully.',
      })
      await fetchInvitations()
    } catch (requestError) {
      toast({
        title: 'Unable to send invitation',
        description:
          requestError instanceof Error ? requestError.message : 'Please try again later.',
        variant: 'error',
      })
    } finally {
      setPendingRequest(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">
            Invite a new owner
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[2fr,1fr,auto] md:items-end">
            <div className="space-y-2">
              <label htmlFor="invitation-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="invitation-email"
                type="email"
                placeholder="team-member@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invitation-expiry" className="text-sm font-medium text-foreground">
                Expires in (days)
              </label>
              <Input
                id="invitation-expiry"
                type="number"
                min={1}
                max={30}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(Number.parseInt(event.target.value, 10) || 7)}
              />
            </div>
            <Button type="submit" disabled={pendingRequest}>
              {pendingRequest ? 'Sending...' : 'Send invitation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Invitation history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-md bg-slate-100" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-600">{error}</p>
              <Button variant="outline" onClick={fetchInvitations}>
                Retry
              </Button>
            </div>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-slate-600">No invitations have been issued yet.</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => {
                const tone = statusTone[invitation.status] ?? 'text-slate-500'
                return (
                  <div
                    key={invitation.id}
                    className="grid gap-1 rounded-md border border-slate-200 p-3 md:grid-cols-[2fr,1fr,1fr]"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{invitation.invitedEmail}</p>
                      {invitation.inviter ? (
                        <p className="text-xs text-slate-500">
                          Invited by {invitation.inviter.displayName ?? invitation.inviter.email ?? 'Unknown'}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
                      <p className={`text-sm font-medium ${tone}`}>{invitation.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Expires</p>
                      <p className="text-sm text-slate-600">{formatDate(invitation.expiresAt)}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs text-slate-500">
                        Created {formatDate(invitation.createdAt)}
                        {invitation.acceptedAt ? ` - Accepted ${formatDate(invitation.acceptedAt)}` : ''}
                      </p>
                    </div>
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
