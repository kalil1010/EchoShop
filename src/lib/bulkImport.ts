/**
 * Bulk import utilities for parsing and validating product data from CSV/Excel files
 */

export interface BulkImportProduct {
  title: string
  description?: string
  price: number
  currency?: string
  status?: 'draft' | 'pending_review' | 'active'
  imageUrl?: string
  sku?: string
}

export interface BulkImportResult {
  valid: BulkImportProduct[]
  errors: Array<{
    row: number
    product: Partial<BulkImportProduct>
    errors: string[]
  }>
}

/**
 * Parse CSV content into product data
 */
export function parseCSV(csvContent: string): BulkImportResult {
  const lines = csvContent.split('\n').filter((line) => line.trim())
  if (lines.length < 2) {
    return {
      valid: [],
      errors: [{ row: 0, product: {}, errors: ['CSV file must have at least a header row and one data row'] }],
    }
  }

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const titleIndex = header.findIndex((h) => h === 'title' || h === 'name' || h === 'product name')
  const descriptionIndex = header.findIndex((h) => h === 'description' || h === 'desc')
  const priceIndex = header.findIndex((h) => h === 'price' || h === 'cost')
  const currencyIndex = header.findIndex((h) => h === 'currency' || h === 'curr')
  const statusIndex = header.findIndex((h) => h === 'status' || h === 'state')
  const imageUrlIndex = header.findIndex((h) => h === 'image' || h === 'imageurl' || h === 'image_url')
  const skuIndex = header.findIndex((h) => h === 'sku' || h === 'product_sku')

  if (titleIndex === -1 || priceIndex === -1) {
    return {
      valid: [],
      errors: [
        {
          row: 0,
          product: {},
          errors: ['CSV must have "title" (or "name") and "price" columns'],
        },
      ],
    }
  }

  const valid: BulkImportProduct[] = []
  const errors: BulkImportResult['errors'] = []

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    const values = row.split(',').map((v) => v.trim())
    const rowErrors: string[] = []

    const product: Partial<BulkImportProduct> = {}

    // Title (required)
    const title = values[titleIndex]?.trim()
    if (!title || title.length === 0) {
      rowErrors.push('Title is required')
    } else if (title.length > 120) {
      rowErrors.push('Title must be 120 characters or less')
    } else {
      product.title = title
    }

    // Description (optional)
    if (descriptionIndex !== -1 && values[descriptionIndex]) {
      const description = values[descriptionIndex].trim()
      if (description.length > 2000) {
        rowErrors.push('Description must be 2000 characters or less')
      } else {
        product.description = description
      }
    }

    // Price (required)
    const priceStr = values[priceIndex]?.trim()
    if (!priceStr) {
      rowErrors.push('Price is required')
    } else {
      const price = parseFloat(priceStr)
      if (isNaN(price) || price < 0) {
        rowErrors.push('Price must be a valid positive number')
      } else {
        product.price = price
      }
    }

    // Currency (optional, defaults to EGP)
    if (currencyIndex !== -1 && values[currencyIndex]) {
      product.currency = values[currencyIndex].trim().toUpperCase() || 'EGP'
    } else {
      product.currency = 'EGP'
    }

    // Status (optional, defaults to draft)
    if (statusIndex !== -1 && values[statusIndex]) {
      const status = values[statusIndex].trim().toLowerCase()
      if (['draft', 'pending_review', 'active'].includes(status)) {
        product.status = status as 'draft' | 'pending_review' | 'active'
      } else {
        rowErrors.push(`Invalid status: ${status}. Must be draft, pending_review, or active`)
      }
    } else {
      product.status = 'draft'
    }

    // Image URL (optional)
    if (imageUrlIndex !== -1 && values[imageUrlIndex]) {
      const imageUrl = values[imageUrlIndex].trim()
      if (imageUrl.length > 0) {
        try {
          new URL(imageUrl) // Validate URL
          product.imageUrl = imageUrl
        } catch {
          rowErrors.push('Image URL must be a valid URL')
        }
      }
    }

    // SKU (optional)
    if (skuIndex !== -1 && values[skuIndex]) {
      product.sku = values[skuIndex].trim()
    }

    if (rowErrors.length > 0) {
      errors.push({ row: i + 1, product, errors: rowErrors })
    } else {
      valid.push(product as BulkImportProduct)
    }
  }

  return { valid, errors }
}

/**
 * Parse Excel content into product data
 * Note: This function is not used directly - Excel parsing is done in the API route
 * using the xlsx library for better error handling
 */
export function parseExcel(excelBuffer: Buffer): BulkImportResult {
  // Excel parsing is handled directly in the API route using xlsx library
  // This function is kept for consistency but not actively used
  return { valid: [], errors: [] }
}

/**
 * Validate a single product
 */
export function validateProduct(product: Partial<BulkImportProduct>): string[] {
  const errors: string[] = []

  if (!product.title || product.title.trim().length === 0) {
    errors.push('Title is required')
  } else if (product.title.length > 120) {
    errors.push('Title must be 120 characters or less')
  }

  if (product.description && product.description.length > 2000) {
    errors.push('Description must be 2000 characters or less')
  }

  if (product.price === undefined || product.price === null) {
    errors.push('Price is required')
  } else if (isNaN(product.price) || product.price < 0) {
    errors.push('Price must be a valid positive number')
  }

  if (product.currency && product.currency.length !== 3) {
    errors.push('Currency must be a 3-letter code (e.g., EGP, USD)')
  }

  if (product.status && !['draft', 'pending_review', 'active'].includes(product.status)) {
    errors.push('Status must be draft, pending_review, or active')
  }

  if (product.imageUrl) {
    try {
      new URL(product.imageUrl)
    } catch {
      errors.push('Image URL must be a valid URL')
    }
  }

  return errors
}

