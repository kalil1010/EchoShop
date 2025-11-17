'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { VendorSelector } from './VendorSelector'

interface ActivityFiltersProps {
  filters: {
    vendorId: string
    actionCategory: string
    actionType: string
    startDate: string
    endDate: string
  }
  onFiltersChange: (filters: ActivityFiltersProps['filters']) => void
}

export function ActivityFilters({ filters, onFiltersChange }: ActivityFiltersProps) {
  const updateFilter = (key: keyof typeof filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({
      vendorId: '',
      actionCategory: '',
      actionType: '',
      startDate: '',
      endDate: '',
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <VendorSelector
          value={filters.vendorId}
          onChange={(value) => updateFilter('vendorId', value)}
          placeholder="Filter by vendor..."
          className="text-sm"
        />
        <select
          value={filters.actionCategory}
          onChange={(e) => updateFilter('actionCategory', e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          <option value="product">Product</option>
          <option value="order">Order</option>
          <option value="profile">Profile</option>
          <option value="payment">Payment</option>
          <option value="other">Other</option>
        </select>
        <Input
          placeholder="Action Type"
          value={filters.actionType}
          onChange={(e) => updateFilter('actionType', e.target.value)}
          className="text-sm"
        />
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => updateFilter('startDate', e.target.value)}
          className="text-sm"
        />
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => updateFilter('endDate', e.target.value)}
          className="text-sm"
        />
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

