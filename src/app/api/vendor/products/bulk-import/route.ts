import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError, sanitizeText } from '@/lib/security'
import { parseCSV, parseExcel, validateProduct, type BulkImportProduct } from '@/lib/bulkImport'
import type { VendorProductStatus } from '@/types/vendor'

export const runtime = 'nodejs'

const MAX_BULK_IMPORT = 100 // Limit bulk imports to 100 products at a time

interface ImportError {
  row: number
  product: Partial<BulkImportProduct>
  errors: string[]
}

interface ImportResult {
  imported: number
  failed: number
  errors: ImportError[]
  skipped: number
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith('.csv')
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

    if (!isCSV && !isExcel) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel (.xlsx, .xls) file.' },
        { status: 400 },
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse file based on type
    let parseResult: { valid: BulkImportProduct[]; errors: ImportError[] }

    if (isCSV) {
      const csvContent = buffer.toString('utf-8')
      parseResult = parseCSV(csvContent)
    } else {
      // Parse Excel file
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const firstSheetName = workbook.SheetNames[0]
      if (!firstSheetName) {
        return NextResponse.json({ error: 'Excel file must have at least one sheet.' }, { status: 400 })
      }

      const worksheet = workbook.Sheets[firstSheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false }) as Record<string, unknown>[]

      if (jsonData.length === 0) {
        return NextResponse.json({ error: 'Excel file is empty.' }, { status: 400 })
      }

      // Convert Excel data to product format
      const valid: BulkImportProduct[] = []
      const errors: ImportError[] = []

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i]
        const product: Partial<BulkImportProduct> = {}

        // Map Excel columns (case-insensitive)
        const titleKey = Object.keys(row).find((k) => /title|name|product\s*name/i.test(k))
        const descKey = Object.keys(row).find((k) => /description|desc/i.test(k))
        const priceKey = Object.keys(row).find((k) => /price|cost/i.test(k))
        const currencyKey = Object.keys(row).find((k) => /currency|curr/i.test(k))
        const statusKey = Object.keys(row).find((k) => /status|state/i.test(k))
        const imageKey = Object.keys(row).find((k) => /image|imageurl|image_url/i.test(k))
        const skuKey = Object.keys(row).find((k) => /sku|product_sku/i.test(k))

        if (titleKey) product.title = String(row[titleKey] || '').trim()
        if (descKey) product.description = String(row[descKey] || '').trim()
        if (priceKey) {
          const price = parseFloat(String(row[priceKey] || '0'))
          product.price = isNaN(price) ? 0 : price
        }
        if (currencyKey) product.currency = String(row[currencyKey] || 'EGP').trim().toUpperCase()
        if (statusKey) {
          const status = String(row[statusKey] || 'draft').trim().toLowerCase()
          if (['draft', 'pending_review', 'active'].includes(status)) {
            product.status = status as VendorProductStatus
          }
        }
        if (imageKey) product.imageUrl = String(row[imageKey] || '').trim()
        if (skuKey) product.sku = String(row[skuKey] || '').trim()

        const validationErrors = validateProduct(product)
        if (validationErrors.length > 0) {
          errors.push({ row: i + 2, product, errors: validationErrors }) // +2 for header row and 1-based indexing
        } else {
          valid.push(product as BulkImportProduct)
        }
      }

      parseResult = { valid, errors }
    }

    // Limit import size
    if (parseResult.valid.length > MAX_BULK_IMPORT) {
      return NextResponse.json(
        {
          error: `Too many products. Maximum ${MAX_BULK_IMPORT} products allowed per import.`,
          imported: 0,
          failed: parseResult.errors.length,
          errors: parseResult.errors,
        },
        { status: 400 },
      )
    }

    if (parseResult.valid.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid products found in file.',
          imported: 0,
          failed: parseResult.errors.length,
          errors: parseResult.errors,
        },
        { status: 400 },
      )
    }

    // Import products
    const result: ImportResult = {
      imported: 0,
      failed: 0,
      errors: [],
      skipped: 0,
    }

    for (const product of parseResult.valid) {
      try {
        // Check if product with same title already exists
        const { data: existing } = await supabase
          .from('vendor_products')
          .select('id')
          .eq('vendor_id', userId)
          .eq('title', sanitizeText(product.title, { maxLength: 120 }))
          .maybeSingle()

        if (existing) {
          result.skipped++
          result.errors.push({
            row: 0,
            product,
            errors: ['Product with this title already exists'],
          })
          continue
        }

        // Create product
        const { error: insertError } = await supabase.from('vendor_products').insert({
          vendor_id: userId,
          title: sanitizeText(product.title, { maxLength: 120 }),
          description: product.description
            ? sanitizeText(product.description, { maxLength: 2000, allowNewlines: true })
            : null,
          price: product.price,
          currency: product.currency || 'EGP',
          status: product.status || 'draft',
          primary_image_url: product.imageUrl || null,
          moderation_status: 'ok',
        })

        if (insertError) {
          result.failed++
          result.errors.push({
            row: 0,
            product,
            errors: [insertError.message || 'Failed to create product'],
          })
        } else {
          result.imported++
        }
      } catch (error) {
        result.failed++
        result.errors.push({
          row: 0,
          product,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        })
      }
    }

    // Add parsing errors
    result.errors.push(...parseResult.errors)
    result.failed += parseResult.errors.length

    return NextResponse.json({
      imported: result.imported,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors.slice(0, 50), // Limit error details to first 50
      message:
        result.imported > 0
          ? `Successfully imported ${result.imported} product${result.imported !== 1 ? 's' : ''}.`
          : 'No products were imported.',
    })
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to import products.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

