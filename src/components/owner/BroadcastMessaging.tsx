'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Badge } from '@/components/ui/badge'
import { Send, Clock, CheckCircle } from 'lucide-react'

interface Broadcast {
  id: string
  subject: string
  body: string
  message_type: string
  status: string
  total_recipients: number
  sent_count: number
  created_at: string
}

export function BroadcastMessaging() {
  const { toast } = useToast()
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)

  useEffect(() => {
    fetchBroadcasts()
  }, [])

  const fetchBroadcasts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/messages/broadcast', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load broadcasts')
      }

      const data = await response.json()
      setBroadcasts(data.broadcasts || [])
    } catch (error) {
      console.error('Error fetching broadcasts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800'
      case 'sending':
        return 'bg-blue-100 text-blue-800'
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Broadcast Messages</h3>
        <Button onClick={() => setShowComposer(true)}>
          <Send className="h-4 w-4 mr-2" />
          New Broadcast
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading broadcasts...</p>
      ) : broadcasts.length === 0 ? (
        <p className="text-sm text-gray-600">No broadcasts found</p>
      ) : (
        <div className="space-y-2">
          {broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="p-3 rounded-md border border-slate-200"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{broadcast.subject}</span>
                  <Badge className={getStatusColor(broadcast.status)}>
                    {broadcast.status}
                  </Badge>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(broadcast.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{broadcast.body.substring(0, 100)}...</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>{broadcast.sent_count} / {broadcast.total_recipients} sent</span>
                <span className="capitalize">{broadcast.message_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

