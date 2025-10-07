'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { OnboardingContextProvider, TourStep } from '@/contexts/OnboardingContext'
import { TourOverlay } from '@/components/onboarding/TourOverlay'
import { getTourState, updateTourState } from '@/lib/onboarding'

const TOUR_SLUG = 'intro_onboarding'
const STORAGE_KEY = 'zmoda-tour-intro-dismissed'

interface OnboardingProviderProps {
  children: React.ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [initialStatus, setInitialStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started')
  const [isReady, setIsReady] = useState(false)

  const steps: TourStep[] = useMemo(() => ([
    {
      id: 'hero-outfit',
      title: 'Build outfits instantly',
      description: 'Use the Outfit Builder to get styled looks tailor-made for your closet and favorite colors.',
      target: '[data-tour="hero-feature-outfit"]',
    },
    {
      id: 'hero-closet',
      title: 'Digitize your wardrobe',
      description: 'Upload pieces to your Digital Closet and track palettes, notes, and outfit ideas.',
      target: '[data-tour="hero-feature-closet"]',
    },
    {
      id: 'hero-analyzer',
      title: 'Analyze colors in seconds',
      description: 'Drop in any photo to discover matching palettes and color-friendly combinations.',
      target: '[data-tour="hero-feature-analyzer"]',
    },
    {
      id: 'hero-chat',
      title: 'Chat with your stylist',
      description: 'Ask ZMODA AI anything—from outfit help to onboarding tips—right from the floating assistant.',
      target: '[data-tour="hero-feature-chat"]',
    },
  ]), [])

  useEffect(() => {
    let active = true
    const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (dismissed === 'completed') {
      setInitialStatus('completed')
      setIsReady(true)
      return
    }

    ;(async () => {
      try {
        const state = await getTourState(TOUR_SLUG)
        if (!active) return
        setInitialStatus(state.status)
      } catch (error) {
        console.warn('Failed to load onboarding state:', error)
      } finally {
        if (active) setIsReady(true)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  const handleStatusChange = useCallback(async (status: 'not_started' | 'in_progress' | 'completed') => {
    if (typeof window !== 'undefined' && status === 'completed') {
      window.localStorage.setItem(STORAGE_KEY, 'completed')
    }
    try {
      await updateTourState(TOUR_SLUG, status)
    } catch (error) {
      console.warn('Failed to update onboarding status:', error)
    }
  }, [])

  if (!isReady) {
    return <>{children}</>
  }

  return (
    <OnboardingContextProvider steps={steps} initialStatus={initialStatus} onStatusChange={handleStatusChange} autoStart={initialStatus !== 'completed'}>
      {children}
      <TourOverlay />
    </OnboardingContextProvider>
  )
}
