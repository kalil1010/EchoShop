/**
 * Bulk Operations Utilities
 * 
 * Helper functions for bulk operations
 */

/**
 * Validate bulk operation request
 */
export function validateBulkOperation(
  ids: string[],
  maxItems: number = 100
): { valid: boolean; error?: string } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { valid: false, error: 'No items selected' }
  }

  if (ids.length > maxItems) {
    return { valid: false, error: `Maximum ${maxItems} items allowed per operation` }
  }

  return { valid: true }
}

/**
 * Chunk array for batch processing
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Process bulk operation with progress tracking
 */
export async function processBulkOperation<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < items.length; i++) {
    try {
      await processor(items[i])
      success++
    } catch (error) {
      failed++
      errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    if (onProgress) {
      onProgress(i + 1, items.length)
    }
  }

  return { success, failed, errors }
}

