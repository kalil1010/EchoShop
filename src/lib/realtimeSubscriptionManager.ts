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
      return this.supabase!
        .channel(config.channelName)
        .on(
          'postgres_changes',
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

