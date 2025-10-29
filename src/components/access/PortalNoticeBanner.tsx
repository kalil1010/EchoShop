'use client'

import Link from 'next/link'

import type { PortalNotice } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const toneClasses: Record<PortalNotice['tone'], { wrapper: string; title: string }> = {
  info: { wrapper: 'border-sky-200 bg-sky-50 text-sky-900', title: 'text-sky-900' },
  success: { wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900', title: 'text-emerald-900' },
  warning: { wrapper: 'border-amber-200 bg-amber-50 text-amber-900', title: 'text-amber-900' },
  danger: { wrapper: 'border-rose-200 bg-rose-50 text-rose-900', title: 'text-rose-900' },
}

interface PortalNoticeBannerProps {
  notice: PortalNotice
}

export function PortalNoticeBanner({ notice }: PortalNoticeBannerProps) {
  const tones = toneClasses[notice.tone] ?? toneClasses.info

  return (
    <div
      className={cn(
        'rounded-lg border p-4 text-sm shadow-sm transition-all',
        'focus-within:ring-2 focus-within:ring-offset-2',
        tones.wrapper,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className={cn('text-sm font-semibold', tones.title)}>{notice.title}</h3>
          <p className="mt-1 text-sm leading-relaxed">{notice.description}</p>
          {notice.helperText ? (
            <p className="mt-2 text-xs opacity-80">{notice.helperText}</p>
          ) : null}
        </div>
        {notice.actionLabel && notice.actionHref ? (
          <Button asChild size="sm" variant="outline" className="shrink-0 border-current bg-white/80">
            <Link href={notice.actionHref}>{notice.actionLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}

