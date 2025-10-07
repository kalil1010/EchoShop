'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ThumbsUp, ThumbsDown, Heart, Bookmark } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { fireConfetti } from '@/lib/confetti'

interface ReactionCounts {
  thumbs_up: number
  thumbs_down: number
  love: number
  bookmark: number
}

type ReactionKey = keyof ReactionCounts

const REACTIONS: Array<{ key: ReactionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'thumbs_up', label: 'Helpful', icon: ThumbsUp },
  { key: 'love', label: 'Love it', icon: Heart },
  { key: 'bookmark', label: 'Save it', icon: Bookmark },
  { key: 'thumbs_down', label: 'Needs work', icon: ThumbsDown },
]

const DEFAULT_COUNTS: ReactionCounts = {
  thumbs_up: 0,
  thumbs_down: 0,
  love: 0,
  bookmark: 0,
}

function getSessionId() {
  if (typeof window === 'undefined') return undefined
  const key = 'zmoda-feedback-session'
  let session = window.localStorage.getItem(key)
  if (!session) {
    const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
    session = random
    window.localStorage.setItem(key, session)
  }
  return session
}

export function ReactionBar({ featureSlug, className }: { featureSlug: string; className?: string }) {
  const [counts, setCounts] = useState<ReactionCounts>(DEFAULT_COUNTS)
  const [pending, setPending] = useState<ReactionKey | null>(null)
  const [userReaction, setUserReaction] = useState<ReactionKey | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`/api/feedback?feature=${encodeURIComponent(featureSlug)}`)
        if (!res.ok) return
        const data = await res.json()
        if (!active) return
        setCounts({ ...DEFAULT_COUNTS, ...(data.counts ?? {}) })
      } catch (error) {
        console.warn('Failed to load feedback counts', error)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [featureSlug])

  const handleReact = useCallback(async (reaction: ReactionKey) => {
    const sessionId = getSessionId()
    setPending(reaction)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: featureSlug, reaction, session_id: sessionId ?? undefined }),
      })
      if (!res.ok) {
        throw new Error('Failed to send feedback')
      }
      setCounts((prev) => ({
        ...prev,
        [reaction]: (prev[reaction] || 0) + 1,
      }))
      setUserReaction(reaction)
      if (reaction === 'thumbs_up' || reaction === 'love') {
        await fireConfetti({ particleCount: 60, spread: 70, origin: { y: 0.9 } })
      }
      toast({ variant: 'success', title: 'Thanks for the feedback!' })
    } catch (error) {
      console.error(error)
      toast({ variant: 'error', title: 'Unable to record feedback', description: 'Please try again soon.' })
    } finally {
      setPending(null)
    }
  }, [featureSlug, toast])

  return (
    <div className={['flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm', className].filter(Boolean).join(' ')}>
      <span className='mr-2 font-medium'>Was this helpful?</span>
      {REACTIONS.map(({ key, label, icon: Icon }) => {
        const count = counts[key] ?? 0
        const isActive = userReaction === key
        return (
          <button
            key={key}
            disabled={pending !== null}
            onClick={() => void handleReact(key)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 transition ${isActive ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-transparent hover:bg-slate-100'}`}
          >
            <Icon className='h-3.5 w-3.5' />
            <span>{label}</span>
            <span className='font-semibold text-slate-400'>{count}</span>
          </button>
        )
      })}
    </div>
  )
}
