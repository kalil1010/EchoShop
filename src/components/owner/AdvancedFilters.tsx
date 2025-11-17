'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AdvancedFiltersProps {
  filters: Record<string, unknown>
  onFiltersChange: (filters: Record<string, unknown>) => void
}

export function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const updateFilter = (key: string, value: unknown) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            value={(filters.type as string) || ''}
            onChange={(e) => updateFilter('type', e.target.value || null)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="user">Users</option>
            <option value="vendor">Vendors</option>
            <option value="product">Products</option>
            <option value="order">Orders</option>
            <option value="payout">Payouts</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date From</label>
          <Input
            type="date"
            value={(filters.date_from as string) || ''}
            onChange={(e) => updateFilter('date_from', e.target.value || null)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Date To</label>
          <Input
            type="date"
            value={(filters.date_to as string) || ''}
            onChange={(e) => updateFilter('date_to', e.target.value || null)}
            className="text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      </div>
    </div>
  )
}

