'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

type TourStatus = 'not_started' | 'in_progress' | 'completed'

export interface TourStep {
  id: string
  title: string
  description: string
  target: string
  media?: { type: 'video' | 'image'; src: string; alt?: string }
}

interface OnboardingContextValue {
  steps: TourStep[]
  currentIndex: number
  status: TourStatus
  isActive: boolean
  startTour: () => void
  goNext: () => void
  goPrev: () => void
  skipTour: () => void
  completeTour: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) {
    throw new Error('useOnboarding requires OnboardingContextProvider')
  }
  return ctx
}

interface ProviderProps {
  children: React.ReactNode
  steps: TourStep[]
  initialStatus: TourStatus
  onStatusChange?: (status: TourStatus) => void
  autoStart?: boolean
}

export function OnboardingContextProvider({ children, steps, initialStatus, onStatusChange, autoStart = false }: ProviderProps) {
  const [status, setStatus] = useState<TourStatus>(initialStatus)
  const [isActive, setIsActive] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const hasStartedRef = useRef(false)
  const autoStartRef = useRef(false)

  const updateStatus = useCallback(
    (next: TourStatus) => {
      setStatus(next)
      onStatusChange?.(next)
    },
    [onStatusChange]
  )

  const startTour = useCallback(() => {
    if (!steps.length) return
    setCurrentIndex(0)
    setIsActive(true)
    updateStatus('in_progress')
    hasStartedRef.current = true
  }, [steps.length, updateStatus])

  const goNext = useCallback(() => {
    if (!isActive) return
    setCurrentIndex((prev) => {
      const next = prev + 1
      if (next >= steps.length) {
        updateStatus('completed')
        setIsActive(false)
        return prev
      }
      return next
    })
  }, [isActive, steps.length, updateStatus])

  const goPrev = useCallback(() => {
    if (!isActive) return
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [isActive])

  const completeTour = useCallback(() => {
    setIsActive(false)
    updateStatus('completed')
  }, [updateStatus])

  const skipTour = useCallback(() => {
    setIsActive(false)
    updateStatus('completed')
  }, [updateStatus])

  useEffect(() => {
    if (status === 'in_progress' && !hasStartedRef.current) {
      startTour()
      return
    }
    if (autoStart && status === 'not_started' && !autoStartRef.current) {
      autoStartRef.current = true
      window.setTimeout(() => {
        startTour()
      }, 300)
    }
  }, [status, startTour, autoStart])

  const value = useMemo<OnboardingContextValue>(() => ({
    steps,
    currentIndex,
    status,
    isActive,
    startTour,
    goNext,
    goPrev,
    skipTour,
    completeTour,
  }), [steps, currentIndex, status, isActive, startTour, goNext, goPrev, skipTour, completeTour])

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

