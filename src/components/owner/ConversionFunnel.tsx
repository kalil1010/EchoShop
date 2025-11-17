'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FunnelData {
  visitors: number
  product_views: number
  add_to_cart: number
  checkout_started: number
  orders_completed: number
  conversion_rates: {
    view_to_cart: number
    cart_to_checkout: number
    checkout_to_order: number
    overall: number
  }
}

export function ConversionFunnel() {
  const [data, setData] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFunnel()
  }, [])

  const fetchFunnel = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/analytics/conversion', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load conversion data')
      }

      const data = await response.json()
      setData(data)
    } catch (error) {
      console.error('Error fetching conversion:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>
  }

  if (!data) {
    return <p className="text-sm text-gray-600">No conversion data available</p>
  }

  const steps = [
    { label: 'Visitors', value: data.visitors, width: 100 },
    { label: 'Product Views', value: data.product_views, width: (data.product_views / data.visitors) * 100 },
    { label: 'Add to Cart', value: data.add_to_cart, width: (data.add_to_cart / data.visitors) * 100 },
    { label: 'Checkout Started', value: data.checkout_started, width: (data.checkout_started / data.visitors) * 100 },
    { label: 'Orders Completed', value: data.orders_completed, width: (data.orders_completed / data.visitors) * 100 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{step.label}</span>
                <span className="text-gray-600">{step.value.toLocaleString()}</span>
              </div>
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-purple-600 transition-all"
                  style={{ width: `${step.width}%` }}
                />
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 text-xs text-gray-600">
                    {step.value > 0 && steps[index + 1].value > 0
                      ? `${((steps[index + 1].value / step.value) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-gray-600">View to Cart</p>
            <p className="text-lg font-bold">{data.conversion_rates.view_to_cart.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Cart to Checkout</p>
            <p className="text-lg font-bold">{data.conversion_rates.cart_to_checkout.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Checkout to Order</p>
            <p className="text-lg font-bold">{data.conversion_rates.checkout_to_order.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Overall Conversion</p>
            <p className="text-lg font-bold">{data.conversion_rates.overall.toFixed(1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

