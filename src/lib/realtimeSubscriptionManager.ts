/**
 * Realtime Subscription Manager
 * 
 * Prevents duplicate subscriptions and manages channel lifecycle
 * to reduce database load from realtime queries.
 * 
 * Features:
 * - Prevents duplicate subscriptions
 * - Exponential backoff for reconnections
 * - Connection pooling
 * - Subscription lifecycle management
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

interface SubscriptionConfig {
  channelName: string
  table: string
  filter: string
  schema?: string
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'
  callback: (payload: unknown) => void | Promise<void>
}

interface ManagedChannel {
  channel: RealtimeChannel
  config: SubscriptionConfig
  unsubscribe: () => void
  reconnectAttempts: number
  maxReconnectAttempts: number
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_RECONNECT_DELAY_MS = 1000 // 1 second
const MAX_RECONNECT_DELAY_MS = 30000 // 30 seconds

class RealtimeSubscriptionManager {
  private channels: Map<string, ManagedChannel> = new Map()
  private supabase: SupabaseClient | null = null

  /**
   * Initialize the manager with a Supabase client
   */
  initialize(supabase: SupabaseClient): void {
    this.supabase = supabase
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS,
    )
    return delay
  }

  /**
   * Subscribe to a table with filtering
   * Returns a cleanup function to unsubscribe
   */
  subscribe(config: SubscriptionConfig): () => void {
    if (!this.supabase) {
      console.warn('[RealtimeManager] Supabase client not initialized')
      return () => {}
    }

    const channelKey = `${config.channelName}-${config.table}-${config.filter}`
    
    // Return existing subscription if already active
    const existing = this.channels.get(channelKey)
    if (existing) {
      console.debug(`[RealtimeManager] Reusing existing subscription: ${channelKey}`)
      return existing.unsubscribe
    }

    const createChannel = (): RealtimeChannel => {
      const channel = this.supabase!
        .channel(config.channelName)
        .on(
          'postgres_changes' as any,
          {
            event: config.event || '*',
            schema: config.schema || 'public',
            table: config.table,
            filter: config.filter,
          },
          async (payload) => {
            try {
              await config.callback(payload)
            } catch (error) {
              console.error(`[RealtimeManager] Callback error for ${channelKey}:`, error)
            }
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Reset reconnect attempts on successful subscription
            const managed = this.channels.get(channelKey)
            if (managed) {
              managed.reconnectAttempts = 0
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Handle reconnection with exponential backoff
            const managed = this.channels.get(channelKey)
            if (managed && managed.reconnectAttempts < managed.maxReconnectAttempts) {
              managed.reconnectAttempts += 1
              const delay = this.calculateBackoffDelay(managed.reconnectAttempts - 1)
              console.warn(
                `[RealtimeManager] Reconnection attempt ${managed.reconnectAttempts}/${managed.maxReconnectAttempts} for ${channelKey} in ${delay}ms`,
              )
              
              setTimeout(() => {
                const stillManaged = this.channels.get(channelKey)
                if (stillManaged) {
                  // Unsubscribe old channel
                  try {
                    if (typeof this.supabase?.removeChannel === 'function') {
                      this.supabase.removeChannel(stillManaged.channel)
                    } else if (typeof stillManaged.channel.unsubscribe === 'function') {
                      stillManaged.channel.unsubscribe()
                    }
                  } catch (error) {
                    console.warn(`[RealtimeManager] Error cleaning up old channel:`, error)
                  }
                  
                  // Create new channel
                  const newChannel = createChannel()
                  stillManaged.channel = newChannel
                }
              }, delay)
            } else if (managed) {
              console.error(
                `[RealtimeManager] Max reconnection attempts reached for ${channelKey}. Unsubscribing.`,
              )
              managed.unsubscribe()
            }
          }
        })
      
      return channel
    }

    const channel = createChannel()

    const unsubscribe = () => {
      const managed = this.channels.get(channelKey)
      if (managed) {
        try {
          if (typeof this.supabase?.removeChannel === 'function') {
            this.supabase.removeChannel(managed.channel)
          } else if (typeof managed.channel.unsubscribe === 'function') {
            managed.channel.unsubscribe()
          }
        } catch (error) {
          console.warn(`[RealtimeManager] Error unsubscribing ${channelKey}:`, error)
        }
        this.channels.delete(channelKey)
        console.debug(`[RealtimeManager] Unsubscribed: ${channelKey}`)
      }
    }

    this.channels.set(channelKey, {
      channel,
      config,
      unsubscribe,
      reconnectAttempts: 0,
      maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
    })

    console.debug(`[RealtimeManager] Subscribed: ${channelKey} (filter: ${config.filter})`)
    return unsubscribe
  }

  /**
   * Unsubscribe from a specific channel
   */
  unsubscribe(channelKey: string): void {
    const managed = this.channels.get(channelKey)
    if (managed) {
      managed.unsubscribe()
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    const channelKeys = Array.from(this.channels.keys())
    channelKeys.forEach((key) => {
      const managed = this.channels.get(key)
      if (managed) {
        managed.unsubscribe()
      }
    })
    this.channels.clear()
    console.debug('[RealtimeManager] Unsubscribed from all channels')
  }

  /**
   * Get count of active subscriptions
   */
  getActiveSubscriptionCount(): number {
    return this.channels.size
  }

  /**
   * Get all active channel keys (for debugging)
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys())
  }

  /**
   * Reconnect all active subscriptions
   * Useful when page becomes visible again after being minimized
   */
  reconnectAll(): void {
    if (!this.supabase) {
      console.warn('[RealtimeManager] Cannot reconnect: Supabase client not initialized')
      return
    }

    const channelKeys = Array.from(this.channels.keys())
    console.debug(`[RealtimeManager] Reconnecting ${channelKeys.length} subscriptions...`)

    channelKeys.forEach((channelKey) => {
      const managed = this.channels.get(channelKey)
      if (!managed) return

      try {
        // Always attempt to reconnect when page becomes visible
        // This ensures connections are restored even if they appear active but are actually stale
        
        // Unsubscribe old channel first
        try {
          if (typeof this.supabase?.removeChannel === 'function') {
            this.supabase.removeChannel(managed.channel)
          } else if (typeof managed.channel.unsubscribe === 'function') {
            managed.channel.unsubscribe()
          }
        } catch (error) {
          // Ignore errors during cleanup - channel might already be closed
          console.debug(`[RealtimeManager] Channel ${channelKey} cleanup note:`, error)
        }

        // Recreate channel with same config
        const createChannel = (): RealtimeChannel => {
          const channel = this.supabase!
            .channel(managed.config.channelName)
            .on(
              'postgres_changes' as any,
              {
                event: managed.config.event || '*',
                schema: managed.config.schema || 'public',
                table: managed.config.table,
                filter: managed.config.filter,
              },
              async (payload) => {
                try {
                  await managed.config.callback(payload)
                } catch (error) {
                  console.error(`[RealtimeManager] Callback error for ${channelKey}:`, error)
                }
              },
            )
            .subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                managed.reconnectAttempts = 0
                console.debug(`[RealtimeManager] Reconnected: ${channelKey}`)
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                // Use existing reconnection logic
                if (managed.reconnectAttempts < managed.maxReconnectAttempts) {
                  managed.reconnectAttempts += 1
                  const delay = this.calculateBackoffDelay(managed.reconnectAttempts - 1)
                  console.warn(
                    `[RealtimeManager] Reconnection attempt ${managed.reconnectAttempts}/${managed.maxReconnectAttempts} for ${channelKey} in ${delay}ms`,
                  )
                  
                  setTimeout(() => {
                    const stillManaged = this.channels.get(channelKey)
                    if (stillManaged) {
                      try {
                        if (typeof this.supabase?.removeChannel === 'function') {
                          this.supabase.removeChannel(stillManaged.channel)
                        } else if (typeof stillManaged.channel.unsubscribe === 'function') {
                          stillManaged.channel.unsubscribe()
                        }
                      } catch (error) {
                        console.warn(`[RealtimeManager] Error cleaning up old channel:`, error)
                      }
                      
                      const newChannel = createChannel()
                      stillManaged.channel = newChannel
                    }
                  }, delay)
                }
              }
            })
          
          return channel
        }

        const newChannel = createChannel()
        managed.channel = newChannel
        managed.reconnectAttempts = 0 // Reset attempts on manual reconnect
      } catch (error) {
        console.error(`[RealtimeManager] Error reconnecting ${channelKey}:`, error)
      }
    })

    console.debug(`[RealtimeManager] Reconnection process initiated for ${channelKeys.length} channels`)
  }

  /**
   * Log subscription statistics (for monitoring/debugging)
   */
  logStatistics(): void {
    const count = this.getActiveSubscriptionCount()
    const channels = this.getActiveChannels()
    console.log(`[RealtimeManager] Active subscriptions: ${count}`, {
      channels,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Track subscription analytics (for production monitoring)
   */
  trackAnalytics(): {
    count: number
    channels: string[]
    timestamp: string
    warning: boolean
  } {
    const count = this.getActiveSubscriptionCount()
    const channels = this.getActiveChannels()
    const MAX_RECOMMENDED_SUBSCRIPTIONS = 10
    const warning = count > MAX_RECOMMENDED_SUBSCRIPTIONS

    if (warning) {
      console.warn(
        `[RealtimeManager] High subscription count detected: ${count} (recommended max: ${MAX_RECOMMENDED_SUBSCRIPTIONS})`,
        { channels },
      )
    }

    // In production, you could send this to your analytics service
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Send to analytics endpoint
      // fetch('/api/analytics/realtime', {
      //   method: 'POST',
      //   body: JSON.stringify({ count, channels, timestamp: new Date().toISOString() }),
      // }).catch(() => {})
    }

    return {
      count,
      channels,
      timestamp: new Date().toISOString(),
      warning,
    }
  }

  /**
   * Monitor connections and alert if excessive
   */
  monitorConnections(): void {
    const analytics = this.trackAnalytics()
    
    if (analytics.warning) {
      // Log warning for developers
      console.warn(
        `[RealtimeManager] Connection monitoring: ${analytics.count} active subscriptions detected.`,
        'Consider reviewing subscription usage to optimize performance.',
        { channels: analytics.channels },
      )
    }
  }
}

// Singleton instance
export const realtimeSubscriptionManager = new RealtimeSubscriptionManager()

/**
 * Hook to use the subscription manager with automatic cleanup
 */
export function useRealtimeSubscription(
  supabase: SupabaseClient | null,
  config: SubscriptionConfig | null,
): () => void {
  if (!supabase || !config) {
    return () => {}
  }

  // Initialize on first use
  if (realtimeSubscriptionManager.getActiveSubscriptionCount() === 0) {
    realtimeSubscriptionManager.initialize(supabase)
  }

  // Subscribe and return cleanup
  const unsubscribe = realtimeSubscriptionManager.subscribe(config)
  
  return unsubscribe
}

