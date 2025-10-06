'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { isPermissionError, mapSupabaseError } from '@/lib/security'
import { SavedPalette } from '@/types/palette'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function MyPalettes() {
  const { user } = useAuth()
  const { toast } = useToast()

  const supabase = useMemo(() => {
    try {
      return getSupabaseClient()
    } catch (error) {
      console.error('Supabase client initialisation failed:', error)
      return null
    }
  }, [])

  const [items, setItems] = useState<SavedPalette[]>([])
  const [loading, setLoading] = useState(false)

  const loadPalettes = useCallback(async () => {
    if (!user?.uid || !supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('palettes')
        .select('*')
        .eq('owner_id', user.uid)
        .order('created_at', { ascending: false })

      if (error) throw mapSupabaseError(error)

      const mapped = (data ?? []).map((row: any) => ({
        id: row.id,
        ownerId: row.owner_id,
        baseHex: row.base_hex,
        dominantHexes: row.dominant_hexes ?? [],
        richMatches: row.rich_matches ?? null,
        plan: row.plan ?? {},
        source: row.source ?? 'analyzer',
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
      })) as SavedPalette[]

      setItems(mapped)
    } catch (error) {
      console.warn('Failed to load palettes:', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Session expired' : 'Access denied',
          description:
            error.reason === 'auth'
              ? 'Please sign in again to view saved palettes.'
              : 'You can only view palettes that belong to you.',
        })
      } else {
        toast({ variant: 'error', title: 'Unable to load palettes', description: 'Please try again later.' })
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [supabase, toast, user?.uid])

  useEffect(() => {
    if (user?.uid) {
      loadPalettes()
    } else {
      setItems([])
    }
  }, [loadPalettes, user?.uid])

  const remove = async (id: string) => {
    if (!supabase) {
      toast({ variant: 'error', title: 'Supabase not configured' })
      return
    }
    if (!user?.uid) {
      toast({ variant: 'error', title: 'Sign in required', description: 'Please sign in before removing palettes.' })
      return
    }
    if (!window.confirm('Remove this saved palette?')) return

    try {
      const { error } = await supabase
        .from('palettes')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.uid)

      if (error) throw mapSupabaseError(error)

      setItems((prev) => prev.filter((item) => item.id !== id))
      toast({ variant: 'success', title: 'Palette removed' })
    } catch (error) {
      console.error('Failed to delete palette:', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Session expired' : 'Action not allowed',
          description:
            error.reason === 'auth'
              ? 'Please sign in again before removing palettes.'
              : 'You can only delete palettes you created.',
        })
      } else {
        toast({ variant: 'error', title: 'Failed to delete palette', description: 'Please try again.' })
      }
    }
  }

  const Row = ({ label, colors }: { label: string; colors: string[] }) => (
    <div className="grid grid-cols-[7rem,1fr] items-center gap-3">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="flex overflow-hidden rounded-md border h-8">
        {colors.map((hex, i) => (
          <div key={hex + i} className="flex-1" style={{ backgroundColor: hex }} title={hex} />
        ))}
      </div>
    </div>
  )

  return (
    <Card className="max-w-4xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>My Palettes</CardTitle>
        <CardDescription>Saved color suggestions and outfit plans</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <div className="text-sm text-gray-600">Loading...</div>}

        {!loading && items.length === 0 && (
          <div className="text-sm text-gray-600">
            No saved palettes yet. Build one in the Analyzer or Closet and click "Save to Profile".
          </div>
        )}

        <div className="space-y-5">
          {items.map((p) => (
            <div key={p.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-gray-600">
                  Saved {p.createdAt.toLocaleString()} | Source: {p.source}
                </div>
                {user?.uid === p.ownerId && (
                  <Button variant="outline" size="sm" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Row label="Base" colors={[p.baseHex]} />

                {p.richMatches && (
                  <>
                    <Row label="Analogous" colors={p.richMatches.analogous || []} />
                    <Row label="Complementary" colors={p.richMatches.complementary ? [p.richMatches.complementary] : []} />
                    <Row label="Split Complementary" colors={p.richMatches.splitComplementary || []} />
                    <Row label="Triadic" colors={p.richMatches.triadic || []} />
                    <Row label="Tetradic" colors={p.richMatches.tetradic || []} />
                    <Row label="Monochrome" colors={p.richMatches.monochrome || []} />
                    <Row label="Neutrals" colors={p.richMatches.neutrals || []} />
                  </>
                )}
              </div>

              {p.plan && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-3">
                  {(['top', 'bottom', 'outerwear', 'footwear', 'accessory'] as const).map((slot) => (
                    <div key={slot} className="rounded border overflow-hidden">
                      <div className="px-2 py-1 text-xs capitalize">{slot}</div>
                      <div
                        className="h-8"
                        style={{ backgroundColor: (p.plan as Record<string, string | undefined>)[slot] || '#f3f4f6' }}
                        title={(p.plan as Record<string, string | undefined>)[slot] || ''}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default MyPalettes

