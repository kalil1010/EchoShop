'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Users, Mail, UserPlus, X, CheckCircle2, Clock, XCircle, Trash2, Edit2, Shield } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

export type AssistantRole = 'viewer' | 'editor' | 'manager'

interface AssistantInvitation {
  id: string
  invitedEmail: string
  assistantRole: AssistantRole
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: string
  expiresAt: string
  acceptedAt?: string
}

interface Assistant {
  id: string
  assistantId: string
  assistantName: string
  assistantEmail: string
  assistantRole: AssistantRole
  createdAt: string
}

const ROLE_LABELS: Record<AssistantRole, string> = {
  viewer: 'Viewer',
  editor: 'Editor',
  manager: 'Manager',
}

const ROLE_DESCRIPTIONS: Record<AssistantRole, string> = {
  viewer: 'Can view products, orders, and analytics. Cannot make changes.',
  editor: 'Can edit products, update orders, and manage inventory. Cannot delete or change settings.',
  manager: 'Full access to all vendor features except security settings and team management.',
}

const ROLE_COLORS: Record<AssistantRole, string> = {
  viewer: 'bg-blue-100 text-blue-700 border-blue-200',
  editor: 'bg-amber-100 text-amber-700 border-amber-200',
  manager: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

interface VendorAssistantsProps {
  vendorId: string
}

export default function VendorAssistants({ vendorId }: VendorAssistantsProps) {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const [invitations, setInvitations] = useState<AssistantInvitation[]>([])
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AssistantRole>('viewer')
  const [inviting, setInviting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [invitationsRes, assistantsRes] = await Promise.all([
        fetch('/api/vendor/assistants/invitations', { credentials: 'include' }),
        fetch('/api/vendor/assistants', { credentials: 'include' }),
      ])

      if (invitationsRes.ok) {
        const data = await invitationsRes.json()
        setInvitations(data.invitations || [])
      }

      if (assistantsRes.ok) {
        const data = await assistantsRes.json()
        setAssistants(data.assistants || [])
      }
    } catch (error) {
      console.error('Failed to load assistants:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        variant: 'error',
        title: 'Email required',
        description: 'Please enter an email address.',
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail.trim())) {
      toast({
        variant: 'error',
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
      })
      return
    }

    setInviting(true)
    try {
      const response = await fetch('/api/vendor/assistants/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invitation')
      }

      toast({
        variant: 'success',
        title: 'Invitation sent',
        description: `Invitation sent to ${inviteEmail.trim()}`,
      })

      setInviteEmail('')
      setInviteRole('viewer')
      setShowInviteForm(false)
      loadData()
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to send invitation',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) {
      return
    }

    try {
      const response = await fetch(`/api/vendor/assistants/invitations/${invitationId}/revoke`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to revoke invitation')
      }

      toast({
        variant: 'success',
        title: 'Invitation revoked',
        description: 'The invitation has been revoked.',
      })

      loadData()
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to revoke invitation',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  const handleRemoveAssistant = async (assistantId: string) => {
    if (!window.confirm('Are you sure you want to remove this assistant?')) {
      return
    }

    try {
      const response = await fetch(`/api/vendor/assistants/${assistantId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove assistant')
      }

      toast({
        variant: 'success',
        title: 'Assistant removed',
        description: 'The assistant has been removed from your team.',
      })

      loadData()
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to remove assistant',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  const handleUpdateRole = async (assistantId: string, newRole: AssistantRole) => {
    try {
      const response = await fetch(`/api/vendor/assistants/${assistantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update role')
      }

      toast({
        variant: 'success',
        title: 'Role updated',
        description: `Assistant role updated to ${ROLE_LABELS[newRole]}.`,
      })

      loadData()
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to update role',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading assistants...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Invite Assistant Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-emerald-600" />
                Invite Assistant
              </CardTitle>
              <CardDescription>
                Invite team members to help manage your store with different access levels.
              </CardDescription>
            </div>
            {!showInviteForm && (
              <Button onClick={() => setShowInviteForm(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Assistant
              </Button>
            )}
          </div>
        </CardHeader>
        {showInviteForm && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="invite-email" className="text-sm font-medium">
                Email Address
              </label>
              <Input
                id="invite-email"
                type="email"
                placeholder="assistant@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="invite-role" className="text-sm font-medium">
                Role
              </label>
              <select
                id="invite-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AssistantRole)}
                disabled={inviting}
              >
                <option value="viewer">Viewer - View only access</option>
                <option value="editor">Editor - Can edit products and orders</option>
                <option value="manager">Manager - Full access except security</option>
              </select>
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[inviteRole]}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </Button>
              <Button variant="outline" onClick={() => setShowInviteForm(false)} disabled={inviting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Active Assistants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Team Members ({assistants.length})
          </CardTitle>
          <CardDescription>People who have access to your vendor dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {assistants.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No team members yet. Invite someone to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {assistants.map((assistant) => (
                <div
                  key={assistant.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <Users className="h-5 w-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium">{assistant.assistantName || assistant.assistantEmail || 'Unknown User'}</p>
                        {assistant.assistantEmail && (
                          <p className="text-sm text-muted-foreground">{assistant.assistantEmail}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      value={assistant.assistantRole}
                      onChange={(e) => handleUpdateRole(assistant.id, e.target.value as AssistantRole)}
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="manager">Manager</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveAssistant(assistant.id)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber-600" />
            Pending Invitations ({invitations.filter((i) => i.status === 'pending').length})
          </CardTitle>
          <CardDescription>Invitations that haven't been accepted yet.</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.filter((i) => i.status === 'pending').length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No pending invitations.</div>
          ) : (
            <div className="space-y-3">
              {invitations
                .filter((i) => i.status === 'pending')
                .map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-medium">{invitation.invitedEmail}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[invitation.assistantRole]}`}
                            >
                              {ROLE_LABELS[invitation.assistantRole]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      className="text-rose-600 hover:text-rose-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            {(['viewer', 'editor', 'manager'] as AssistantRole[]).map((role) => (
              <div key={role} className="rounded-lg border border-blue-200 bg-white p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
                    {ROLE_LABELS[role]}
                  </span>
                </div>
                <p className="text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

