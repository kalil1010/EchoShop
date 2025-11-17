'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Image, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Evidence {
  id: string
  evidence_type: string
  file_url: string | null
  description: string | null
  submitted_by_type: string
  created_at: string
}

export function DisputeEvidenceViewer({ disputeId }: { disputeId: string }) {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvidence()
  }, [disputeId])

  const fetchEvidence = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/evidence`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load evidence')
      }

      const data = await response.json()
      setEvidence(data.evidence || [])
    } catch (error) {
      console.error('Error fetching evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading evidence...</div>
  }

  if (evidence.length === 0) {
    return (
      <div>
        <h3 className="font-semibold mb-2">Evidence</h3>
        <p className="text-sm text-gray-500">No evidence submitted</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Evidence</h3>
      <div className="space-y-3">
        {evidence.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-md border border-slate-200"
          >
            {item.evidence_type === 'image' ? (
              <Image className="h-5 w-5 text-gray-400 mt-0.5" />
            ) : (
              <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">{item.evidence_type}</p>
              {item.description && (
                <p className="text-xs text-gray-600 mt-1">{item.description}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Submitted by {item.submitted_by_type} • {new Date(item.created_at).toLocaleDateString()}
              </p>
            </div>
            {item.file_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 mr-1" />
                  View
                </a>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

