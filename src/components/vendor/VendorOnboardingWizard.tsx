'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Building2,
  UploadCloud,
  BarChart3,
  Image as ImageIcon,
  Share2,
  X,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import type { VendorProduct } from '@/types/vendor'

export interface OnboardingTask {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  completed: boolean
  action?: {
    label: string
    tab?: string
    route?: string
  }
}

interface VendorOnboardingWizardProps {
  onComplete?: () => void
  onDismiss?: () => void
}

export default function VendorOnboardingWizard({ onComplete, onDismiss }: VendorOnboardingWizardProps) {
  const { userProfile } = useAuth()
  const [products, setProducts] = useState<VendorProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  // Check if onboarding was previously dismissed
  useEffect(() => {
    const dismissedKey = `vendor_onboarding_dismissed_${userProfile?.uid}`
    const wasDismissed = typeof window !== 'undefined' ? localStorage.getItem(dismissedKey) === 'true' : false
    setDismissed(wasDismissed)
  }, [userProfile?.uid])

  // Fetch products to check if first product is uploaded
  useEffect(() => {
    if (!userProfile?.uid) return

    let active = true
    setProductsLoading(true)

    fetch('/api/vendor/products', { credentials: 'include' })
      .then((response) => {
        if (!active) return
        if (!response.ok) return
        return response.json()
      })
      .then((payload) => {
        if (!active) return
        const list: VendorProduct[] = Array.isArray(payload?.products) ? payload.products : []
        setProducts(list)
      })
      .catch((error) => {
        if (!active) return
        console.warn('[VendorOnboardingWizard] Failed to load products:', error)
      })
      .finally(() => {
        if (active) setProductsLoading(false)
      })

    return () => {
      active = false
    }
  }, [userProfile?.uid])

  // Define onboarding tasks
  const tasks = useMemo<OnboardingTask[]>(() => {
    const hasBusinessName = Boolean(userProfile?.vendorBusinessName?.trim())
    const hasBusinessAddress = Boolean(userProfile?.vendorBusinessAddress?.trim())
    const hasContactEmail = Boolean(userProfile?.vendorContactEmail?.trim() || userProfile?.email)
    const businessProfileComplete = hasBusinessName && hasBusinessAddress && hasContactEmail

    const hasProducts = products.length > 0
    const hasActiveProduct = products.some((p) => p.status === 'active')
    const productUploaded = hasProducts || hasActiveProduct

    // Check if analytics has been visited
    const analyticsVisitedKey = userProfile?.uid
      ? `vendor_onboarding_analytics_visited_${userProfile.uid}`
      : null
    const analyticsVisited =
      analyticsVisitedKey && typeof window !== 'undefined'
        ? localStorage.getItem(analyticsVisitedKey) === 'true'
        : false

    const hasLogo = false // TODO: Check when logo upload is implemented
    const hasBanner = false // TODO: Check when banner upload is implemented
    const hasSocialLinks =
      Boolean(userProfile?.vendorWebsite?.trim()) ||
      false // TODO: Check social links when implemented

    return [
      {
        id: 'business-profile',
        title: 'Complete your business profile',
        description: 'Add your business name, address, and contact information',
        icon: Building2,
        completed: businessProfileComplete,
        action: {
          label: 'Go to Business Profile',
          tab: 'business',
        },
      },
      {
        id: 'upload-product',
        title: 'Upload your first product',
        description: 'Add at least one product to start selling',
        icon: UploadCloud,
        completed: productUploaded,
        action: {
          label: 'Upload Product',
          tab: 'products',
        },
      },
      {
        id: 'review-analytics',
        title: 'Review your analytics',
        description: 'Learn how to track your product performance',
        icon: BarChart3,
        completed: analyticsVisited, // Mark complete when analytics tab is visited
        action: {
          label: 'View Analytics',
          tab: 'analytics',
        },
      },
      {
        id: 'add-branding',
        title: 'Add logo and banner (optional)',
        description: 'Customize your storefront with branding',
        icon: ImageIcon,
        completed: hasLogo && hasBanner,
        action: {
          label: 'Add Branding',
          tab: 'business',
        },
      },
      {
        id: 'social-links',
        title: 'Connect social media (optional)',
        description: 'Link your Instagram, Facebook, or Twitter',
        icon: Share2,
        completed: hasSocialLinks,
        action: {
          label: 'Add Social Links',
          tab: 'business',
        },
      },
    ]
  }, [userProfile, products])

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks])
  const totalTasks = tasks.length
  const progressPercentage = useMemo(() => Math.round((completedCount / totalTasks) * 100), [completedCount, totalTasks])
  const allCompleted = completedCount === totalTasks

  const handleTaskClick = useCallback(
    (task: OnboardingTask) => {
      if (task.action?.tab) {
        // Trigger custom event to switch tabs in parent component
        const event = new CustomEvent('vendor-onboarding-navigate', { detail: { tab: task.action.tab } })
        window.dispatchEvent(event)
      } else if (task.action?.route) {
        window.location.href = task.action.route
      }
    },
    [],
  )

  const handleDismiss = useCallback(() => {
    if (userProfile?.uid) {
      const dismissedKey = `vendor_onboarding_dismissed_${userProfile.uid}`
      localStorage.setItem(dismissedKey, 'true')
    }
    setDismissed(true)
    onDismiss?.()
  }, [userProfile?.uid, onDismiss])

  const handleComplete = useCallback(() => {
    if (userProfile?.uid) {
      const dismissedKey = `vendor_onboarding_dismissed_${userProfile.uid}`
      localStorage.setItem(dismissedKey, 'true')
    }
    setDismissed(true)
    onComplete?.()
  }, [userProfile?.uid, onComplete])

  // Don't render if dismissed or all tasks completed
  if (dismissed || allCompleted) {
    return null
  }

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-lg">
      <CardHeader className="relative pb-4">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding wizard"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-start gap-3 pr-8">
          <div className="rounded-full bg-emerald-100 p-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Welcome to your vendor dashboard!</CardTitle>
            <CardDescription className="mt-1">
              Complete these steps to get your store up and running
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Progress</span>
            <span className="font-semibold text-emerald-600">
              {completedCount} of {totalTasks} completed
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {tasks.map((task) => {
            const Icon = task.icon
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => handleTaskClick(task)}
                className="group flex w-full items-start gap-3 rounded-lg border border-transparent bg-background p-3 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-sm"
              >
                <div className="mt-0.5 flex-shrink-0">
                  {task.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground group-hover:text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`h-4 w-4 ${task.completed ? 'text-emerald-600' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={`font-medium ${task.completed ? 'text-emerald-700 line-through' : 'text-foreground'}`}
                    >
                      {task.title}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                  {task.action && !task.completed && (
                    <div className="flex items-center gap-1 pt-1 text-sm text-emerald-600">
                      <span className="font-medium">{task.action.label}</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Completion Message */}
        {allCompleted && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center">
            <p className="font-semibold text-emerald-700">🎉 Congratulations! You're all set!</p>
            <p className="mt-1 text-sm text-emerald-600">Your vendor dashboard is ready to go.</p>
            <Button onClick={handleComplete} className="mt-3" size="sm">
              Get Started
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

