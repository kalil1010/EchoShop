'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HelpArticle {
  slug: string
  title: string
  body_md: string
  video_url?: string | null
  updated_at?: string
}

const FALLBACK_ARTICLES: HelpArticle[] = [
  {
    slug: 'tour',
    title: 'Take the guided tour',
    body_md: 'Launch the onboarding tour from the floating assistant anytime to see each feature in context.',
    video_url: null,
  },
  {
    slug: 'closet-tips',
    title: 'Upload closet pieces like a pro',
    body_md: 'Choose natural lighting, crop to the garment, and add notes so outfits can reference your preferences.',
    video_url: null,
  },
]

export function HelpSection() {
  const [articles, setArticles] = useState<HelpArticle[]>(FALLBACK_ARTICLES)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch('/api/help?limit=4')
        if (!res.ok) return
        const data: HelpArticle[] = await res.json()
        if (!active || !Array.isArray(data) || !data.length) return
        setArticles(data)
        const firstWithVideo = data.find((article) => article.video_url)
        setVideoUrl(firstWithVideo?.video_url ?? null)
      } catch (error) {
        console.warn('Failed to load help articles', error)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <section className='mt-16 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur'>
      <div className='flex flex-col gap-6 lg:flex-row'>
        <div className='flex-1 space-y-4'>
          <h2 className='text-2xl font-bold text-slate-900 md:text-3xl'>Help & FAQ</h2>
          <p className='text-sm text-slate-600'>Short answers to popular questions, plus quick videos to show you around.</p>
          <div className='space-y-3'>
            {articles.map((article) => (
              <details key={article.slug} className='rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600'>
                <summary className='cursor-pointer text-base font-semibold text-slate-900'>{article.title}</summary>
                <p className='mt-2 whitespace-pre-line'>{article.body_md}</p>
                {article.video_url ? (
                  <Link href={article.video_url} className='mt-2 inline-flex items-center text-xs font-semibold text-purple-600 hover:text-purple-700'>Watch video ?</Link>
                ) : null}
              </details>
            ))}
          </div>
        </div>
        <div className='flex-1 rounded-2xl bg-slate-900/90 p-6 text-white shadow-lg'>
          <p className='text-sm font-semibold uppercase tracking-wide text-purple-200'>Quick start clip</p>
          <h3 className='mt-2 text-xl font-semibold'>Walk through the Echo Shop basics in 90 seconds</h3>
          <div className='mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40'>
            {videoUrl ? (
              <video src={videoUrl} controls className='h-full w-full rounded-2xl'>
                Your browser does not support embedded videos.
              </video>
            ) : (
              <div className='flex h-48 items-center justify-center text-sm text-white/70'>Video coming soon</div>
            )}
          </div>
          <p className='mt-4 text-xs text-white/70'>Need more help? Ping the assistant or email <a className='underline' href='mailto:support@echoshop.ai'>support@echoshop.ai</a>.</p>
        </div>
      </div>
    </section>
  )
}

