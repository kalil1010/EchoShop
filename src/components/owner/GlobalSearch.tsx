'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Save } from 'lucide-react'
import { AdvancedFilters } from './AdvancedFilters'
import { SavedFilters } from './SavedFilters'

interface SearchResult {
  type: 'user' | 'vendor' | 'product' | 'order' | 'payout'
  id: string
  title: string
  description: string
  metadata: Record<string, unknown>
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Record<string, unknown>>({})
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('q', query)
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value))
      })

      const response = await fetch(`/api/admin/search?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      params.set('q', query)
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value))
      })

      const response = await fetch(`/api/admin/search/export?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `search-results-${new Date().toISOString()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 text-blue-800'
      case 'vendor':
        return 'bg-green-100 text-green-800'
      case 'product':
        return 'bg-purple-100 text-purple-800'
      case 'order':
        return 'bg-yellow-100 text-yellow-800'
      case 'payout':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Global Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search users, vendors, products, orders..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>

          {showFilters && (
            <AdvancedFilters filters={filters} onFiltersChange={setFilters} />
          )}

          <SavedFilters onSelect={(savedFilters) => setFilters(savedFilters)} />

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Found {results.length} result(s)
              </p>
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="p-3 rounded-md border border-slate-200"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={getTypeColor(result.type)}>
                      {result.type}
                    </Badge>
                    <span className="font-semibold">{result.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{result.description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

