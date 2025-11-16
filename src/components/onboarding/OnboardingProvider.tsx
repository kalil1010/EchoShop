'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { OnboardingContextProvider, TourStep } from '@/contexts/OnboardingContext'
import { TourOverlay } from '@/components/onboarding/TourOverlay'
import { getTourState, updateTourState } from '@/lib/onboarding'
import { useAuth } from '@/contexts/AuthContext'

interface OnboardingProviderProps {
  children: React.ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { role, roleMeta, user } = useAuth()
  const [initialStatus, setInitialStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started')
  const [isReady, setIsReady] = useState(false)

  const tourConfig = useMemo(() => {
    if (role === 'vendor') {
      const personaLabel = roleMeta.shortLabel ?? 'Vendor'
      const vendorSteps: TourStep[] = [
        {
          id: 'vendor-welcome',
          title: 'Start with your vendor hub',
          description: `The ${personaLabel.toLowerCase()} welcome card highlights priority actions, product status, and business checklists.`,
          target: '[data-tour="vendor-welcome-card"]',
        },
        {
          id: 'vendor-products',
          title: 'Add or update products',
          description: 'Jump into the Products tab to upload items, manage drafts, and monitor moderation.',
          target: '[data-tour="vendor-action-products"]',
        },
        {
          id: 'vendor-analytics',
          title: 'Watch performance metrics',
          description: 'Track approvals, drafts, and top listings from the Analytics tab.',
          target: '[data-tour="vendor-tab-analytics"]',
        },
      ]
      return {
        slug: 'vendor_portal_walkthrough',
        storageKey: 'echo-shop-tour-vendor-intro',
        steps: vendorSteps,
      }
    }

    if (role === 'owner') {
      const personaLabel = roleMeta.shortLabel ?? 'Owner'
      const ownerSteps: TourStep[] = [
        {
          id: 'owner-welcome',
          title: 'Review system highlights',
          description: `Your ${personaLabel.toLowerCase()} console welcome card surfaces vendor actions and marketplace health.`,
          target: '[data-tour="owner-welcome-card"]',
        },
        {
          id: 'owner-requests',
          title: 'Handle vendor onboarding',
          description: 'Open the Vendor Requests tab to approve or decline pending applications.',
          target: '[data-tour="owner-tab-requests"]',
        },
        {
          id: 'owner-analytics',
          title: 'Monitor marketplace health',
          description: 'Use the Analytics tab to understand adoption, content flow, and review load.',
          target: '[data-tour="owner-tab-analytics"]',
        },
      ]
      return {
        slug: 'owner_console_walkthrough',
        storageKey: 'echo-shop-tour-owner-intro',
        steps: ownerSteps,
      }
    }

    const userSteps: TourStep[] = [
      {
        id: 'nav-closet',
        title: 'Digitize your closet',
        description: `Store outfits and pieces in one place so ${roleMeta.shortLabel.toLowerCase()} suggestions stay personal.`,
        target: '[data-tour="nav-my-closet"]',
      },
      {
        id: 'nav-profile',
        title: 'Complete your profile',
        description: 'Add your measurements and style preferences to personalize every suggestion.',
        target: '[data-tour="nav-profile"]',
      },
      {
        id: 'nav-outfit',
        title: 'Build outfits in seconds',
        description: 'Use the Outfit Suggestions tool to get AI-styled looks for every occasion.',
        target: '[data-tour="nav-outfit"]',
      },
      {
        id: 'assistant-help',
        title: 'Chat with Echo Shop Assistant',
        description: 'Tap the assistant any time for a guided tour, styling tips, or troubleshooting help.',
        target: '[data-tour="floating-assistant"]',
      },
    ]

    return {
      slug: 'customer_onboarding',
      storageKey: 'echo-shop-tour-customer-intro',
      steps: userSteps,
    }
  }, [role, roleMeta])

  useEffect(() => {
    setIsReady(false)
    setInitialStatus('not_started')
    let active = true
    const dismissed = typeof window !== 'undefined' ? window.localStorage.getItem(tourConfig.storageKey) : null
    if (dismissed === 'completed') {
      setInitialStatus('completed')
      setIsReady(true)
      return
    }

    ;(async () => {
      try {
        const state = await getTourState(tourConfig.slug)
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
  }, [tourConfig])

  const handleStatusChange = useCallback(async (status: 'not_started' | 'in_progress' | 'completed') => {
    if (typeof window !== 'undefined' && status === 'completed') {
      window.localStorage.setItem(tourConfig.storageKey, 'completed')
    }
    try {
      // Only update tour state if user is authenticated
      // This prevents 401 errors during session restoration
      if (!user) {
        console.debug('[OnboardingProvider] Skipping tour state update - user not authenticated')
        return
      }
      await updateTourState(tourConfig.slug, status)
    } catch (error) {
      // Silently handle errors - they're expected during session restoration
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Not authenticated') || errorMessage.includes('401')) {
        console.debug('[OnboardingProvider] Tour state update skipped - not authenticated')
      } else {
        console.warn('Failed to update onboarding status:', error)
      }
    }
  }, [tourConfig, user])

  if (!isReady) {
    return <>{children}</>
  }

  return (
    <OnboardingContextProvider steps={tourConfig.steps} initialStatus={initialStatus} onStatusChange={handleStatusChange} autoStart={initialStatus !== 'completed'}>
      {children}
      <TourOverlay />
    </OnboardingContextProvider>
  )
}

