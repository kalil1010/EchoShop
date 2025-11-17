'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, TrendingDown, ShoppingCart } from 'lucide-react'

interface RevenueData {
  total_revenue: number
  period_revenue: number
  period_growth: number
  total_orders: number
  period_orders: number
  orders_growth: number
  avg_order_value: number
  period_avg_order_value: number
  aov_growth: number
}

export function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    fetchRevenue()
  }, [period])

  const fetchRevenue = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics/revenue?period=${period}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load revenue data')
      }

      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Error fetching revenue:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-gray-600">No revenue data available</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(['7d', '30d', '90d', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded text-sm ${
              period === p
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p === 'all' ? 'All Time' : p}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {data.total_revenue.toLocaleString()} EGP
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {data.period_growth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={data.period_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(data.period_growth).toFixed(1)}%
              </span>
              <span className="text-gray-500">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data.total_orders.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {data.orders_growth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={data.orders_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(data.orders_growth).toFixed(1)}%
              </span>
              <span className="text-gray-500">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {data.avg_order_value.toLocaleString()} EGP
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {data.aov_growth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={data.aov_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(data.aov_growth).toFixed(1)}%
              </span>
              <span className="text-gray-500">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Period Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {data.period_revenue.toLocaleString()} EGP
            </div>
            <p className="text-xs text-gray-500 mt-1">Last {period}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

