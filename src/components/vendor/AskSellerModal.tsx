'use client'

import React, { useState } from 'react'
import { X, Send, MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

interface AskSellerModalProps {
  isOpen: boolean
  onClose: () => void
  vendorId: string
  vendorName: string
  productId?: string | null
}

export default function AskSellerModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  productId,
}: AskSellerModalProps) {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)

  React.useEffect(() => {
    if (isOpen && productId) {
      setSubject(`Question about product`)
    } else if (isOpen) {
      setSubject(`Question for ${vendorName}`)
    }
  }, [isOpen, productId, vendorName])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !userProfile) {
      toast({
        variant: 'error',
        title: 'Sign in required',
        description: 'Please sign in to send a message to the seller.',
      })
      return
    }

    if (!message.trim()) {
      toast({
        variant: 'error',
        title: 'Message required',
        description: 'Please enter your message before sending.',
      })
      return
    }

    setSending(true)
    try {
      // TODO: Implement actual API call to send message
      const response = await fetch('/api/vendor/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          vendorId,
          productId: productId || null,
          subject: subject.trim() || `Question for ${vendorName}`,
          message: message.trim(),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to send message')
      }

      toast({
        variant: 'success',
        title: 'Message sent',
        description: `Your message has been sent to ${vendorName}. They'll respond soon!`,
      })

      setMessage('')
      setSubject('')
      onClose()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({
        variant: 'error',
        title: 'Failed to send',
        description: error instanceof Error ? error.message : 'Unable to send message. Please try again.',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Ask {vendorName}
            </CardTitle>
            <CardDescription>
              {productId
                ? 'Have a question about this product? Send a message to the seller.'
                : 'Send a message to this vendor.'}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="subject" className="text-sm font-medium mb-1 block">
                Subject
              </label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's your question about?"
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="message" className="text-sm font-medium mb-1 block">
                Message
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  productId
                    ? 'Ask about sizing, materials, shipping, or anything else...'
                    : 'Ask about products, policies, or anything else...'
                }
                rows={6}
                maxLength={1000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {message.length}/1000 characters
              </p>
            </div>
            {!user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p>You need to sign in to send a message. Please sign in and try again.</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={sending}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || !user || !message.trim()}>
                {sending ? (
                  <>
                    <Send className="h-4 w-4 mr-2 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

