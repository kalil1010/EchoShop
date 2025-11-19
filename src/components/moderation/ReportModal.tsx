'use client'

import React, { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

type ReportType = 'post' | 'user'

interface ReportModalProps {
  type: ReportType
  targetId: string
  targetName?: string
  open: boolean
  onClose: () => void
  onReported?: () => void
}

const POST_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'harassment', label: 'Harassment or Bullying' },
  { value: 'violence', label: 'Violence or Dangerous Content' },
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'false_information', label: 'False Information' },
  { value: 'intellectual_property', label: 'Intellectual Property Violation' },
  { value: 'other', label: 'Other' },
] as const

const USER_REASONS = [
  { value: 'spam', label: 'Spam Account' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'fake_account', label: 'Fake Account' },
  { value: 'other', label: 'Other' },
] as const

export function ReportModal({
  type,
  targetId,
  targetName,
  open,
  onClose,
  onReported,
}: ReportModalProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reasons = type === 'post' ? POST_REASONS : USER_REASONS

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason || submitting) return

    setSubmitting(true)
    try {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData?.session?.access_token

      if (!accessToken) {
        throw new Error('Session expired')
      }

      const endpoint = type === 'post' ? '/api/report/post' : '/api/report/user'
      const body = type === 'post'
        ? { postId: targetId, reason, description: description || undefined }
        : { userId: targetId, reason, description: description || undefined }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit report')
      }

      toast({
        variant: 'success',
        title: 'Report submitted',
        description: 'Thank you for helping keep our community safe.',
      })

      // Reset form
      setReason('')
      setDescription('')
      onReported?.()
      onClose()
    } catch (error) {
      console.error('[ReportModal] Error submitting report:', error)
      toast({
        variant: 'error',
        title: 'Failed to submit report',
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle>Report {type === 'post' ? 'Post' : 'User'}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            {type === 'post'
              ? 'Help us understand what\'s wrong with this post.'
              : `Help us understand why you're reporting ${targetName || 'this user'}.`}
          </CardDescription>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Reason</label>
              <div className="space-y-2">
                {reasons.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={(e) => setReason(e.target.value)}
                      className="text-purple-500"
                      disabled={submitting}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Additional Details (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any additional context..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                maxLength={500}
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!reason || submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

