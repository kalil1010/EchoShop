'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react'

interface VendorBenchmark {
  vendor_id: string
  vendor_name: string
  total_revenue: number
  total_orders: number
  avg_order_value: number
  unique_customers: number
  active_products: number
  rank: number
}

export function VendorBenchmarking() {
  const [benchmarks, setBenchmarks] = useState<VendorBenchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'customers'>('revenue')

  useEffect(() => {
    fetchBenchmarks()
  }, [sortBy])

  const fetchBenchmarks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics/benchmarks?sort_by=${sortBy}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load benchmarks')
      }

      const data = await response.json()
      setBenchmarks(data.benchmarks || [])
    } catch (error) {
      console.error('Error fetching benchmarks:', error)
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
        <div className="flex items-center justify-between">
          <CardTitle>Vendor Benchmarking</CardTitle>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'revenue' | 'orders' | 'customers')}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
          >
            <option value="revenue">Sort by Revenue</option>
            <option value="orders">Sort by Orders</option>
            <option value="customers">Sort by Customers</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {benchmarks.length === 0 ? (
          <p className="text-sm text-gray-600">No benchmark data available</p>
        ) : (
          <div className="space-y-3">
            {benchmarks.map((vendor, index) => (
              <div
                key={vendor.vendor_id}
                className="flex items-center justify-between p-4 rounded-md border border-slate-200"
              >
                <div className="flex items-center gap-3 flex-1">
                  {index < 3 && (
                    <Trophy className={`h-6 w-6 ${
                      index === 0 ? 'text-yellow-500' :
                      index === 1 ? 'text-gray-400' :
                      'text-orange-600'
                    }`} />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">#{vendor.rank} {vendor.vendor_name}</span>
                      {index < 3 && (
                        <Badge className="bg-purple-100 text-purple-800">
                          Top {index + 1}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 space-x-4">
                      <span>{vendor.total_orders} orders</span>
                      <span>{vendor.unique_customers} customers</span>
                      <span>{vendor.active_products} products</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{vendor.total_revenue.toLocaleString()} EGP</div>
                  <div className="text-xs text-gray-500">
                    Avg: {vendor.avg_order_value.toLocaleString()} EGP
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

