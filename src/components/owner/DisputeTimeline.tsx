'use client'

import React, { useState, useEffect } from 'react'
import { Clock, User, MessageSquare } from 'lucide-react'

interface TimelineEvent {
  id: string
  event_type: string
  description: string
  actor_type: string | null
  created_at: string
}

export function DisputeTimeline({ disputeId }: { disputeId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimeline()
  }, [disputeId])

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/timeline`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load timeline')
      }

      const data = await response.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Error fetching timeline:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading timeline...</div>
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Timeline</h3>
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No timeline events</p>
        ) : (
          events.map((event) => (
            <div key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                {event.id !== events[events.length - 1].id && (
                  <div className="w-0.5 h-full bg-gray-200"></div>
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                  {event.actor_type && (
                    <span className="text-xs text-gray-500">
                      by {event.actor_type}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-900">{event.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

