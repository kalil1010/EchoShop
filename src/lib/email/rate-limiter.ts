/**
 * Rate Limiter for Email Webhooks
 * 
 * Simple in-memory rate limiter to prevent email spam.
 * For production at scale, consider using a distributed rate limiter
 * like Upstash Redis or similar.
 * 
 * NOTE: This is an in-memory implementation. In a multi-instance deployment,
 * each instance maintains its own counter. For distributed rate limiting,
 * use a shared store like Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Timestamp when the window resets
}

// In-memory store for rate limit entries
// Key format: `webhook-{userId}` or `webhook-{email}`
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 10; // Maximum requests per window per user

/**
 * Clean up expired entries (runs periodically)
 * This prevents memory leaks in long-running processes
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup expired entries every 5 minutes
// Only run in Node.js environment (not in Edge runtime)
if (typeof setInterval !== 'undefined' && typeof process !== 'undefined') {
  try {
    setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
  } catch (error) {
    // Ignore errors in environments where setInterval is not available
    // (e.g., Edge runtime)
  }
}

/**
 * Check if a request should be rate limited
 * 
 * @param identifier - Unique identifier for rate limiting (e.g., user ID or email)
 * @param maxRequests - Maximum number of requests allowed in the window (default: 10)
 * @param windowMs - Time window in milliseconds (default: 1 hour)
 * @returns Object with `allowed` boolean and `remaining` requests count
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
  windowMs: number = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `webhook-${identifier}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // If no entry exists or window has expired, create a new one
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment count
  entry.count += 1;
  
  // Check if limit exceeded
  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);
  
  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit for an identifier (useful for testing or manual overrides)
 */
export function resetRateLimit(identifier: string): void {
  const key = `webhook-${identifier}`;
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(identifier: string): {
  count: number;
  remaining: number;
  resetAt: number;
} | null {
  const key = `webhook-${identifier}`;
  const entry = rateLimitStore.get(key);
  
  if (!entry) {
    return null;
  }
  
  const now = Date.now();
  if (entry.resetAt < now) {
    return null; // Expired
  }
  
  return {
    count: entry.count,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count),
    resetAt: entry.resetAt,
  };
}

