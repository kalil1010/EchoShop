/**
 * Feature Flags Client-Side Utility
 * 
 * Check feature flags on the client side
 */

interface FeatureFlag {
  flag_key: string
  flag_name: string
  is_enabled: boolean
  is_global: boolean
  rollout_percentage: number
}

/**
 * Check if a feature is enabled for the current user/vendor
 */
export async function isFeatureEnabled(flagKey: string, vendorId?: string): Promise<boolean> {
  try {
    const params = new URLSearchParams()
    params.set('flag_key', flagKey)
    if (vendorId) {
      params.set('vendor_id', vendorId)
    }

    const response = await fetch(`/api/feature-flags/check?${params.toString()}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      return false // Default to disabled on error
    }

    const data = await response.json()
    return data.enabled === true
  } catch (error) {
    console.error('Error checking feature flag:', error)
    return false // Default to disabled on error
  }
}

/**
 * Get all enabled features for the current user/vendor
 */
export async function getEnabledFeatures(vendorId?: string): Promise<string[]> {
  try {
    const params = new URLSearchParams()
    if (vendorId) {
      params.set('vendor_id', vendorId)
    }

    const response = await fetch(`/api/feature-flags/enabled?${params.toString()}`, {
      credentials: 'include',
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    return data.features || []
  } catch (error) {
    console.error('Error fetching enabled features:', error)
    return []
  }
}

/**
 * React hook for feature flags
 */
export function useFeatureFlag(flagKey: string, vendorId?: string): boolean {
  const [enabled, setEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let mounted = true

    isFeatureEnabled(flagKey, vendorId)
      .then((result) => {
        if (mounted) {
          setEnabled(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setEnabled(false)
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [flagKey, vendorId])

  return enabled
}

// Import React for the hook
import React from 'react'

