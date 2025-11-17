'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Save, X } from 'lucide-react'

interface SavedFilter {
  id: string
  filter_name: string
  filters: Record<string, unknown>
}

export function SavedFilters({ onSelect }: { onSelect: (filters: Record<string, unknown>) => void }) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useEffect(() => {
    // Load saved filters from localStorage or API
    const saved = localStorage.getItem('saved_filters')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [])

  const saveFilter = (name: string, filters: Record<string, unknown>) => {
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      filter_name: name,
      filters,
    }
    const updated = [...savedFilters, newFilter]
    setSavedFilters(updated)
    localStorage.setItem('saved_filters', JSON.stringify(updated))
    setShowSaveDialog(false)
  }

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id)
    setSavedFilters(updated)
    localStorage.setItem('saved_filters', JSON.stringify(updated))
  }

  if (savedFilters.length === 0 && !showSaveDialog) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">Saved Filters:</span>
        {savedFilters.map((filter) => (
          <Button
            key={filter.id}
            variant="outline"
            size="sm"
            onClick={() => onSelect(filter.filters)}
            className="text-xs"
          >
            {filter.filter_name}
            <X
              className="h-3 w-3 ml-1"
              onClick={(e) => {
                e.stopPropagation()
                deleteFilter(filter.id)
              }}
            />
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          className="text-xs"
        >
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
      </div>
      {showSaveDialog && (
        <div className="p-2 rounded border border-slate-200 bg-white">
          <input
            type="text"
            placeholder="Filter name"
            className="w-full px-2 py-1 text-sm border rounded"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const name = e.currentTarget.value
                if (name) {
                  saveFilter(name, {})
                  e.currentTarget.value = ''
                }
              }
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}

