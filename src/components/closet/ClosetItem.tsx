'use client'

import React, { useState } from 'react'
import { Trash2, Eye } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClothingItem } from '@/types/clothing'
import { getColorName } from '@/lib/imageAnalysis'

export interface ClosetItemProps {
  item: ClothingItem
  onDelete: (item: ClothingItem) => void
  onView: (item: ClothingItem) => void
  canManage?: boolean
}

export function ClosetItem({ item, onDelete, onView, canManage = true }: ClosetItemProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  const handleDelete = () => {
    if (!canManage) return
    onDelete(item)
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-square relative bg-gray-100">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse bg-gray-200 w-full h-full" />
          </div>
        )}
        <img
          src={item.imageUrl}
          alt={item.description || 'Clothing item'}
          className={`w-full h-full object-cover cursor-pointer transition-opacity ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onClick={() => onView(item)}
        />
      </div>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium capitalize flex items-center gap-2">
              {item.garmentType}
              {item.primaryHex && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]">
                  <span
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: item.primaryHex }}
                  />
                  Primary
                </span>
              )}
            </span>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" onClick={() => onView(item)}>
                <Eye className="h-4 w-4" />
              </Button>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {item.description && (
            <p className="text-xs text-gray-600 truncate">
              {item.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {item.dominantColors.slice(0, 3).map((color, index) => (
              <div key={color + index} className="inline-flex items-center gap-1">
                <span
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-gray-600">
                  {item.colorNames && item.colorNames[index]
                    ? item.colorNames[index]
                    : getColorName(color)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ClosetItem
