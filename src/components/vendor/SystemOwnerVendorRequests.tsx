'use client'

import React, { useMemo, useState } from 'react'

import type { VendorRequest } from '@/types/vendor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type RequestWithUser = VendorRequest & {
  displayName?: string | null
}

interface SystemOwnerVendorRequestsProps {
  initialRequests: RequestWithUser[]
}

type ActionState = {
  id: string
  loading: boolean
  action: 'approve' | 'reject'
}

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
}

const formatDateTime = (value: string | undefined) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function SystemOwnerVendorRequests({ initialRequests }: SystemOwnerVendorRequestsProps) {
  const [requests, setRequests] = useState<RequestWithUser[]>(initialRequests)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [actionState, setActionState] = useState<ActionState | null>(null)
  const { toast } = useToast()

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests])
  const processedRequests = useMemo(() => requests.filter((request) => request.status !== 'pending'), [requests])

  const submitAction = async (id: string, action: 'approve' | 'reject') => {
    setActionState({ id, loading: true, action })
    try {
      const response = await fetch(`/api/admin/vendor-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNotes: notes[id] }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const description =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Unable to update the vendor request at this time.'
        throw new Error(description)
      }

      const payload = await response.json()
      if (payload?.request) {
        setRequests((prev) =>
          prev.map((request) => (request.id === id ? { ...request, ...payload.request } : request)),
        )
      }

      toast({
        variant: action === 'approve' ? 'success' : 'default',
        title: action === 'approve' ? 'Vendor approved' : 'Request rejected',
        description:
          action === 'approve'
            ? 'The user now has access to the vendor portal.'
            : 'The applicant has been notified of the decision.',
      })
    } catch (error) {
      const description =
        error instanceof Error ? error.message : 'Unexpected error while updating vendor request.'
      toast({ variant: 'error', title: 'Action failed', description })
    } finally {
      setActionState(null)
    }
  }

  return (
    <div className="space-y-10">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Pending vendor applications</CardTitle>
          <CardDescription>
            Review requests submitted by customers. Approving a request automatically upgrades the user to the vendor role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending applications at the moment.</p>
          ) : (
            <div className="space-y-5">
              {pendingRequests.map((request) => {
                const currentState = actionState?.id === request.id ? actionState : null
                return (
                  <div key={request.id} className="rounded-lg border border-border p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {request.displayName || 'Unknown user'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Submitted {formatDateTime(request.createdAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[request.status]}`}>
                        {request.status}
                      </span>
                    </div>
                    {request.message ? (
                      <div className="rounded-md bg-muted px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                        {request.message}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Applicant did not include additional notes.</p>
                    )}
                    <div className="space-y-2">
                      <label htmlFor={`notes-${request.id}`} className="text-sm font-medium text-foreground">
                        Reviewer notes <span className="text-muted-foreground">(optional)</span>
                      </label>
                      <Textarea
                        id={`notes-${request.id}`}
                        rows={3}
                        placeholder="Add context or conditions for the vendor. Applicants will see this note."
                        value={notes[request.id] ?? ''}
                        onChange={(event) =>
                          setNotes((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={() => submitAction(request.id, 'approve')}
                        disabled={currentState?.loading}
                      >
                        {currentState?.action === 'approve' && currentState.loading ? 'Approving…' : 'Approve vendor'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => submitAction(request.id, 'reject')}
                        disabled={currentState?.loading}
                      >
                        {currentState?.action === 'reject' && currentState.loading ? 'Rejecting…' : 'Reject request'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Processed applications</CardTitle>
          <CardDescription>
            A history of all reviewed requests, including the final status and any admin notes supplied.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {processedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No processed requests yet.</p>
          ) : (
            <div className="space-y-4">
              {processedRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {request.displayName || 'Unknown user'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Submitted {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_COLORS[request.status]}`}>
                      {request.status}
                    </span>
                  </div>
                  {request.message ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.message}</p>
                  ) : null}
                  {request.adminNotes ? (
                    <p className="text-xs text-muted-foreground">
                      Admin notes: <span className="text-foreground">{request.adminNotes}</span>
                    </p>
                  ) : null}
                  {request.decidedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Decision made {formatDateTime(request.decidedAt)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
