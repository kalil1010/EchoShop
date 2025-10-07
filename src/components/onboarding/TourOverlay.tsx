'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useOnboarding } from '@/contexts/OnboardingContext'

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const ANIMATION_DURATION = 200

export function TourOverlay() {
  const { steps, currentIndex, isActive, goNext, goPrev, skipTour } = useOnboarding()
  const [container, setContainer] = useState<Element | null>(null)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const step = steps[currentIndex]
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    setContainer(document.body)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!isActive || !step) {
      setRect(null)
      return
    }
    const el = document.querySelector(step.target)
    if (!el) {
      setRect(null)
      return
    }

    const update = () => {
      const bounds = el.getBoundingClientRect()
      setRect({
        top: bounds.top + window.scrollY,
        left: bounds.left + window.scrollX,
        width: bounds.width,
        height: bounds.height,
      })
    }

    update()
    const handle = () => {
      update()
      rafRef.current = requestAnimationFrame(handle)
    }
    rafRef.current = requestAnimationFrame(handle)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [isActive, step])

  useEffect(() => {
    setIsAnimating(true)
    const id = window.setTimeout(() => setIsAnimating(false), ANIMATION_DURATION)
    return () => window.clearTimeout(id)
  }, [currentIndex])

  if (!container || !isActive || !step) return null

  return createPortal(
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] transition-all"
          style={{
            top: rect.top - 12,
            left: rect.left - 12,
            width: rect.width + 24,
            height: rect.height + 24,
            transitionDuration: `${ANIMATION_DURATION}ms`,
          }}
        />
      )}
      <div
        className={cn(
          'pointer-events-auto absolute max-w-sm rounded-xl bg-white p-5 shadow-xl transition-all',
          isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        )}
        style={{
          top: rect ? Math.min(rect.top + rect.height + 24, window.scrollY + window.innerHeight - 160) : '30%',
          left: rect ? Math.min(rect.left, window.scrollX + window.innerWidth - 360) : '50%',
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">Step {currentIndex + 1} of {steps.length}</p>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{step.description}</p>
        {step.media && step.media.type === 'video' ? (
          <video className="mt-4 w-full rounded-lg" src={step.media.src} autoPlay loop muted playsInline />
        ) : null}
        {step.media && step.media.type === 'image' ? (
          <img className="mt-4 w-full rounded-lg" src={step.media.src} alt={step.media.alt || ''} />
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2 text-sm">
          <button onClick={skipTour} className="rounded-md px-3 py-1.5 text-slate-500 hover:text-slate-700">Skip</button>
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={currentIndex === 0}
            >
              Back
            </button>
            <button
              onClick={goNext}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-white shadow hover:bg-purple-700"
            >
              {currentIndex === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    container
  )
}
