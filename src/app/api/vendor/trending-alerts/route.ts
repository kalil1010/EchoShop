import { NextRequest, NextResponse } from 'next/server'

import { resolveAuthenticatedUser } from '@/lib/server/auth'
import { requireVendorUser } from '@/lib/server/vendor'
import { createServiceClient } from '@/lib/supabaseServer'
import { mapSupabaseError, PermissionError } from '@/lib/security'

export const runtime = 'nodejs'

interface TrendingAlert {
  id: string
  type: 'category' | 'style' | 'color' | 'product'
  title: string
  message: string
  trend: 'up' | 'down'
  percentage: number
  actionUrl?: string
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await resolveAuthenticatedUser(request)
    await requireVendorUser(userId)

    const supabase = createServiceClient()

    // Get vendor's active products
    const { data: products, error: productsError } = await supabase
      .from('vendor_products')
      .select('id, title, status, ai_colors, created_at')
      .eq('vendor_id', userId)
      .eq('status', 'active')

    if (productsError) {
      throw productsError
    }

    const alerts: TrendingAlert[] = []

    // Analyze trending colors from vendor's products
    if (products && products.length > 0) {
      const colorCounts: Record<string, number> = {}
      products.forEach((product) => {
        if (product.ai_colors && Array.isArray(product.ai_colors)) {
          product.ai_colors.forEach((color: { name?: string; hex?: string }) => {
            const colorName = color.name?.toLowerCase() || 'unknown'
            colorCounts[colorName] = (colorCounts[colorName] || 0) + 1
          })
        }
      })

      // Find most common colors
      const sortedColors = Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)

      sortedColors.forEach(([colorName, count], index) => {
        if (count >= 2) {
          const percentage = Math.round((count / products.length) * 100)
          alerts.push({
            id: `color-${colorName}-${index}`,
            type: 'color',
            title: `${colorName.charAt(0).toUpperCase() + colorName.slice(1)} is popular in your store`,
            message: `${count} of your ${products.length} active products feature ${colorName}. Consider adding more items in this color.`,
            trend: 'up',
            percentage,
            actionUrl: '/atlas?tab=products',
          })
        }
      })
    }

    // Check for low inventory alerts (if products have inventory tracking)
    if (products && products.length < 5) {
      alerts.push({
        id: 'low-inventory',
        type: 'product',
        title: 'Expand your catalog',
        message: `You have ${products.length} active products. Consider adding more items to increase visibility.`,
        trend: 'up',
        percentage: Math.round((products.length / 10) * 100),
        actionUrl: '/atlas?tab=products',
      })
    }

    // Check for products pending review
    const { data: pendingProducts } = await supabase
      .from('vendor_products')
      .select('id')
      .eq('vendor_id', userId)
      .eq('status', 'pending_review')

    if (pendingProducts && pendingProducts.length > 0) {
      alerts.push({
        id: 'pending-review',
        type: 'product',
        title: 'Products awaiting review',
        message: `You have ${pendingProducts.length} product${pendingProducts.length > 1 ? 's' : ''} pending review. They'll be live once approved.`,
        trend: 'up',
        percentage: 0,
        actionUrl: '/atlas?tab=products&filter=pending_review',
      })
    }

    // Simulate trending categories (in production, this would analyze marketplace-wide trends)
    const trendingCategories = ['dresses', 'accessories', 'outerwear']
    const randomCategory = trendingCategories[Math.floor(Math.random() * trendingCategories.length)]
    alerts.push({
      id: `trending-${randomCategory}`,
      type: 'category',
      title: `${randomCategory.charAt(0).toUpperCase() + randomCategory.slice(1)} are trending`,
      message: `${randomCategory} are seeing increased interest. Consider adding items in this category.`,
      trend: 'up',
      percentage: Math.floor(Math.random() * 30) + 10,
      actionUrl: '/atlas?tab=products',
    })

    return NextResponse.json({ alerts: alerts.slice(0, 5) }) // Limit to 5 alerts
  } catch (error) {
    const mapped = mapSupabaseError(error)
    if (mapped instanceof PermissionError) {
      const status = mapped.reason === 'auth' ? 401 : 403
      return NextResponse.json({ error: mapped.message }, { status })
    }
    const message = mapped instanceof Error ? mapped.message : 'Unable to load trending alerts.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

