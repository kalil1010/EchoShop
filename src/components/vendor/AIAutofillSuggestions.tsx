'use client'

import React, { useState } from 'react'
import { Sparkles, Loader2, Check, X, Wand2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface AIAutofillSuggestionsProps {
  imageUrl?: string
  onTitleSuggestion?: (title: string) => void
  onDescriptionSuggestion?: (description: string) => void
  onTagsSuggestion?: (tags: string[]) => void
  onColorsSuggestion?: (colors: Array<{ name: string; hex: string }>) => void
}

interface SuggestionState {
  title: string | null
  description: string | null
  tags: string[]
  colors: Array<{ name: string; hex: string }>
  loading: boolean
  error: string | null
}

export default function AIAutofillSuggestions({
  imageUrl,
  onTitleSuggestion,
  onDescriptionSuggestion,
  onTagsSuggestion,
  onColorsSuggestion,
}: AIAutofillSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    title: null,
    description: null,
    tags: [],
    colors: [],
    loading: false,
    error: null,
  })

  const generateSuggestions = async () => {
    if (!imageUrl) {
      setSuggestions((prev) => ({ ...prev, error: 'Please upload an image first' }))
      return
    }

    setSuggestions((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/vendor/products/ai-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to generate suggestions')
      }

      const payload = await response.json()
      const newSuggestions: SuggestionState = {
        title: payload.title || null,
        description: payload.description || null,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        colors: Array.isArray(payload.colors) ? payload.colors : [],
        loading: false,
        error: null,
      }

      setSuggestions(newSuggestions)
    } catch (error) {
      setSuggestions((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      }))
    }
  }

  const applyTitle = () => {
    if (suggestions.title && onTitleSuggestion) {
      onTitleSuggestion(suggestions.title)
    }
  }

  const applyDescription = () => {
    if (suggestions.description && onDescriptionSuggestion) {
      onDescriptionSuggestion(suggestions.description)
    }
  }

  const applyTags = () => {
    if (suggestions.tags.length > 0 && onTagsSuggestion) {
      onTagsSuggestion(suggestions.tags)
    }
  }

  const applyColors = () => {
    if (suggestions.colors.length > 0 && onColorsSuggestion) {
      onColorsSuggestion(suggestions.colors)
    }
  }

  if (!imageUrl) {
    return null
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-900">AI Suggestions</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateSuggestions}
              disabled={suggestions.loading}
            >
              {suggestions.loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>

          {suggestions.error && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{suggestions.error}</div>
          )}

          {suggestions.title && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Suggested Title</span>
                <Button variant="ghost" size="sm" onClick={applyTitle}>
                  <Check className="mr-1 h-3 w-3" />
                  Apply
                </Button>
              </div>
              <p className="text-sm text-slate-900">{suggestions.title}</p>
            </div>
          )}

          {suggestions.description && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Suggested Description</span>
                <Button variant="ghost" size="sm" onClick={applyDescription}>
                  <Check className="mr-1 h-3 w-3" />
                  Apply
                </Button>
              </div>
              <p className="text-sm text-slate-600">{suggestions.description}</p>
            </div>
          )}

          {suggestions.tags.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Suggested Tags</span>
                <Button variant="ghost" size="sm" onClick={applyTags}>
                  <Check className="mr-1 h-3 w-3" />
                  Apply All
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {suggestions.colors.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Detected Colors</span>
                <Button variant="ghost" size="sm" onClick={applyColors}>
                  <Check className="mr-1 h-3 w-3" />
                  Apply
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.colors.map((color, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1"
                  >
                    <div
                      className="h-4 w-4 rounded-full border border-slate-300"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs font-medium text-slate-700">{color.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

