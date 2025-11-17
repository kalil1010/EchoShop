'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { Plus, Edit, Trash2 } from 'lucide-react'

interface Template {
  id: string
  template_name: string
  subject: string
  body: string
  template_type: string
  variables: string[]
  usage_count: number
}

export function MessageTemplates() {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/messages/templates', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Message Templates</h3>
        <Button onClick={() => {
          setSelectedTemplate(null)
          setShowEditor(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading templates...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-600">No templates found</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-3 rounded-md border border-slate-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{template.template_name}</span>
                  <span className="text-xs text-gray-500 capitalize">{template.template_type}</span>
                  <span className="text-xs text-gray-500">Used {template.usage_count} times</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{template.subject}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

