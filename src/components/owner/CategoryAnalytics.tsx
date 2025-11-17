'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Package } from 'lucide-react'

interface CategoryData {
  category: string
  product_count: number
  order_count: number
  revenue: number
  growth: number
}

export function CategoryAnalytics() {
  const [data, setData] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/analytics/categories', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load category data')
      }

      const data = await response.json()
      setData(data.categories || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-600">No category data available</p>
        ) : (
          <div className="space-y-3">
            {data.map((category) => (
              <div
                key={category.category}
                className="flex items-center justify-between p-3 rounded-md border border-slate-200"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="font-semibold capitalize">{category.category || 'Uncategorized'}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {category.product_count} products • {category.order_count} orders
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{category.revenue.toLocaleString()} EGP</div>
                  <div className="flex items-center gap-1 text-xs">
                    {category.growth >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />
                    )}
                    <span className={category.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {Math.abs(category.growth).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

