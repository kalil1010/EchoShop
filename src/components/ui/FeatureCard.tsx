'use client'

import Link from 'next/link'
import type { ComponentType, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  href: string
  cta?: string
  accent?: 'primary' | 'secondary' | 'neutral'
  dataTour?: string
  eyebrow?: ReactNode
}

const ACCENT_STYLES: Record<'primary' | 'secondary' | 'neutral', string> = {
  primary: 'border-purple-500/40 bg-purple-50 text-purple-900 shadow-[0_15px_40px_-25px_rgba(124,58,237,0.6)]',
  secondary: 'border-sky-400/40 bg-sky-50 text-sky-900 shadow-[0_15px_40px_-25px_rgba(56,189,248,0.55)]',
  neutral: 'border-slate-200 bg-white text-slate-900 shadow-sm',
}

export function FeatureCard({ icon: Icon, title, description, href, cta = 'Explore', accent = 'neutral', dataTour, eyebrow }: FeatureCardProps) {
  return (
    <Link
      href={href}
      data-tour={dataTour}
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500',
        ACCENT_STYLES[accent]
      )}
    >
      <div className='flex items-center justify-between gap-4'>
        <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-purple-600 shadow-inner shadow-white/40 group-hover:scale-105 transition-transform'>
          <Icon className='h-6 w-6' />
        </div>
        <ArrowRight className='h-5 w-5 text-slate-400 transition group-hover:text-purple-500' />
      </div>
      {eyebrow ? <span className='mt-4 text-xs font-semibold uppercase tracking-wide text-purple-500'>{eyebrow}</span> : null}
      <h3 className='mt-2 text-xl font-semibold leading-tight'>{title}</h3>
      <p className='mt-2 text-sm text-slate-600'>{description}</p>
      <span className='mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-600'>
        {cta}
        <ArrowRight className='h-4 w-4' />
      </span>
    </Link>
  )
}

