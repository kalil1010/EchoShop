'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Shirt, Package, Loader2 } from 'lucide-react'

import { ClosetItem } from '@/components/closet/ClosetItem'
import ImageUpload from '@/components/closet/ImageUpload'
import { ItemDetailModal } from '@/components/closet/ItemDetailModal'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getUserClothing, deleteClothingItem, groupClothingByType } from '@/lib/closet'
import { isPermissionError } from '@/lib/security'
import { ClothingItem } from '@/types/clothing'

export function ClosetView() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<ClothingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const loadItems = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    try {
      const userItems = await getUserClothing(user.uid)
      setItems(userItems)
    } catch (error) {
      console.warn('Failed to load closet items:', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Authentication required' : 'Access denied',
          description:
            error.reason === 'auth'
              ? 'Please sign in again to view your closet.'
              : 'You can only view and manage your own closet items.',
        })
      } else {
        toast({ variant: 'error', title: 'Unable to load closet', description: 'Please try again later.' })
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [toast, user?.uid])

  useEffect(() => {
    if (user?.uid) {
      loadItems()
    } else {
      setItems([])
      setLoading(false)
    }
  }, [loadItems, user?.uid])

  const handleDeleteItem = async (item: ClothingItem) => {
    if (!user?.uid || item.userId !== user.uid) {
      toast({ variant: 'error', title: 'Not authorized', description: 'You can only delete your own items.' })
      return
    }
    const confirmed = window.confirm('Are you sure you want to delete this item?')
    if (!confirmed) return

    try {
      await deleteClothingItem(item)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast({ variant: 'success', title: 'Item removed' })
    } catch (error) {
      console.error('Failed to delete item:', error)
      if (isPermissionError(error)) {
        toast({
          variant: 'error',
          title: error.reason === 'auth' ? 'Session expired' : 'Action not allowed',
          description:
            error.reason === 'auth'
              ? 'Please sign in again to continue.'
              : 'You cannot delete items that do not belong to you.',
        })
      } else {
        toast({ variant: 'error', title: 'Failed to delete item', description: 'Please try again.' })
      }
    }
  }

  const handleViewItem = (item: ClothingItem) => {
    setSelectedItem(item)
    setShowModal(true)
  }

  const handleItemAdded = (newItem: ClothingItem) => {
    setItems((prev) => [newItem, ...prev])
  }

  const groupedItems = groupClothingByType(items)
  const garmentTypes = ['all', 'top', 'bottom', 'footwear', 'outerwear', 'accessory']

  const getItemsForTab = (tab: string) => (tab === 'all' ? items : groupedItems[tab] || [])

  const getTabLabel = (type: string) => {
    const labels: Record<string, string> = {
      all: 'All Items',
      top: 'Tops',
      bottom: 'Bottoms',
      footwear: 'Footwear',
      outerwear: 'Outerwear',
      accessory: 'Accessories',
    }
    return labels[type] ?? type
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your closet...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              My Closet ({items.length} items)
            </CardTitle>
            <CardDescription>Manage your clothing collection and view color analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6">
                {garmentTypes.map((type) => (
                  <TabsTrigger key={type} value={type} className="text-xs">
                    {getTabLabel(type)}
                  </TabsTrigger>
                ))}
              </TabsList>

              {garmentTypes.map((type) => (
                <TabsContent key={type} value={type} className="mt-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {getItemsForTab(type).map((item) => (
                      <ClosetItem
                        key={item.id}
                        item={item}
                        onDelete={handleDeleteItem}
                        onView={handleViewItem}
                        canManage={item.userId === user?.uid}
                      />
                    ))}
                  </div>

                  {getItemsForTab(type).length === 0 && (
                    <div className="text-center py-12">
                      <Shirt className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">
                        No {type === 'all' ? 'items' : getTabLabel(type).toLowerCase()}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {type === 'all'
                          ? 'Start building your digital closet by adding your first item.'
                          : `Add some ${getTabLabel(type).toLowerCase()} to your closet.`}
                      </p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div>
        <ImageUpload onItemAdded={handleItemAdded} />
      </div>

      <ItemDetailModal item={selectedItem} isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}

export default ClosetView

