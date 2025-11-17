'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Users } from 'lucide-react'

interface Segment {
  id: string
  segment_name: string
  description: string | null
  vendor_count: number
  criteria: Record<string, unknown>
}

export function VendorSegments() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSegments()
  }, [])

  const fetchSegments = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/messages/segments', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load segments')
      }

      const data = await response.json()
      setSegments(data.segments || [])
    } catch (error) {
      console.error('Error fetching segments:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Vendor Segments</h3>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Segment
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading segments...</p>
      ) : segments.length === 0 ? (
        <p className="text-sm text-gray-600">No segments found</p>
      ) : (
        <div className="space-y-2">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className="flex items-center justify-between p-3 rounded-md border border-slate-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{segment.segment_name}</span>
                  <Badge className="bg-blue-100 text-blue-800">
                    {segment.vendor_count} vendors
                  </Badge>
                </div>
                {segment.description && (
                  <p className="text-sm text-gray-600 mt-1">{segment.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

