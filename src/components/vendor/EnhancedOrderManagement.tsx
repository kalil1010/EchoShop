'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { 
  Package, Search, Filter, Download, MessageSquare, Printer, 
  CheckCircle2, XCircle, Clock, Truck, Loader2, Eye, X
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'

interface Order {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  items: Array<{
    productId: string
    productTitle: string
    quantity: number
    price: number
    currency: string
  }>
  total: number
  currency: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  shippingAddress?: string
  notes?: string
}

interface EnhancedOrderManagementProps {
  vendorId: string
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending Payment',
  paid: 'Paid',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
}

const formatPrice = (price: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

export default function EnhancedOrderManagement({ vendorId }: EnhancedOrderManagementProps) {
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vendor/orders', {
        credentials: 'include',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to load orders')
      }

      const payload = await response.json()
      setOrders(Array.isArray(payload.orders) ? payload.orders : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load orders'
      toast({
        variant: 'error',
        title: 'Load failed',
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orders, searchQuery, statusFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      pending: 0,
      paid: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    }
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1
    })
    return counts
  }, [orders])

  const handleStatusUpdate = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    setProcessingIds((prev) => new Set(prev).add(orderId))
    try {
      const response = await fetch(`/api/vendor/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error ?? 'Failed to update order status')
      }

      toast({
        variant: 'success',
        title: 'Status updated',
        description: `Order status updated to ${STATUS_LABELS[newStatus]}.`,
      })

      fetchOrders()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update status'
      toast({
        variant: 'error',
        title: 'Update failed',
        description: message,
      })
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
    }
  }, [toast, fetchOrders])

  const handleExport = useCallback(() => {
    const csv = [
      ['Order Number', 'Customer', 'Email', 'Items', 'Total', 'Status', 'Date'].join(','),
      ...filteredOrders.map((order) =>
        [
          `"${order.orderNumber}"`,
          `"${order.customerName.replace(/"/g, '""')}"`,
          `"${order.customerEmail.replace(/"/g, '""')}"`,
          order.items.length,
          order.total,
          order.status,
          new Date(order.createdAt).toISOString(),
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      variant: 'success',
      title: 'Export completed',
      description: 'Your orders have been exported to CSV.',
    })
  }, [filteredOrders, toast])

  const handlePrintInvoice = useCallback((order: Order) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice - ${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
            .invoice-details { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f5f5f5; }
            .total { text-align: right; font-weight: bold; font-size: 1.2em; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice</h1>
            <p>Order Number: ${order.orderNumber}</p>
            <p>Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
          <div class="invoice-details">
            <h3>Customer Information</h3>
            <p>Name: ${order.customerName}</p>
            <p>Email: ${order.customerEmail}</p>
            ${order.shippingAddress ? `<p>Shipping Address: ${order.shippingAddress}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                .map(
                  (item) => `
                <tr>
                  <td>${item.productTitle}</td>
                  <td>${item.quantity}</td>
                  <td>${formatPrice(item.price, item.currency)}</td>
                  <td>${formatPrice(item.price * item.quantity, item.currency)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="total">Total:</td>
                <td class="total">${formatPrice(order.total, order.currency)}</td>
              </tr>
            </tfoot>
          </table>
          <p>Status: ${STATUS_LABELS[order.status]}</p>
        </body>
      </html>
    `

    printWindow.document.write(invoiceHtml)
    printWindow.document.close()
    printWindow.print()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
          <p className="mt-4 text-slate-600">Loading orders...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Order Management</h2>
          <p className="text-sm text-slate-600">Track and manage customer orders</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-slate-500 mt-1">Total Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{statusCounts.pending}</div>
            <p className="text-xs text-slate-500 mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{statusCounts.paid}</div>
            <p className="text-xs text-slate-500 mt-1">Paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">{statusCounts.shipped}</div>
            <p className="text-xs text-slate-500 mt-1">Shipped</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{statusCounts.delivered}</div>
            <p className="text-xs text-slate-500 mt-1">Delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search orders by number, customer name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status as OrderStatus)}
                >
                  {label.split(' ')[0]} ({statusCounts[status as OrderStatus]})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 text-slate-600">
              {searchQuery || statusFilter !== 'all'
                ? 'No orders match your filters.'
                : 'No orders yet. Orders will appear here once customers make purchases.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isProcessing = processingIds.has(order.id)

            return (
              <Card key={order.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-slate-900">Order #{order.orderNumber}</h3>
                          <p className="text-sm text-slate-600">
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span
                          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}
                        >
                          {STATUS_LABELS[order.status]}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <p className="font-medium text-slate-700">Customer</p>
                          <p className="text-slate-600">{order.customerName}</p>
                          <p className="text-slate-500">{order.customerEmail}</p>
                        </div>
                        {order.shippingAddress && (
                          <div>
                            <p className="font-medium text-slate-700">Shipping Address</p>
                            <p className="text-slate-600">{order.shippingAddress}</p>
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">Items</p>
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">
                                {item.productTitle} × {item.quantity}
                              </span>
                              <span className="font-medium text-slate-900">
                                {formatPrice(item.price * item.quantity, item.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t pt-2">
                          <span className="font-semibold text-slate-900">Total</span>
                          <span className="text-lg font-bold text-emerald-600">
                            {formatPrice(order.total, order.currency)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:flex-col">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(order)}
                        disabled={isProcessing}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePrintInvoice(order)}
                        disabled={isProcessing}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print Invoice
                      </Button>
                      {order.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order.id, 'paid')}
                          disabled={isProcessing}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Paid
                        </Button>
                      )}
                      {order.status === 'paid' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order.id, 'shipped')}
                          disabled={isProcessing}
                        >
                          <Truck className="mr-2 h-4 w-4" />
                          Mark Shipped
                        </Button>
                      )}
                      {order.status === 'shipped' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order.id, 'delivered')}
                          disabled={isProcessing}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Delivered
                        </Button>
                      )}
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                          disabled={isProcessing}
                          className="text-rose-600 hover:text-rose-700"
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>Order #{selectedOrder.orderNumber}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-medium text-slate-700">Customer Information</p>
                <p className="text-slate-900">{selectedOrder.customerName}</p>
                <p className="text-slate-600">{selectedOrder.customerEmail}</p>
                {selectedOrder.shippingAddress && (
                  <p className="mt-2 text-slate-600">{selectedOrder.shippingAddress}</p>
                )}
              </div>
              <div>
                <p className="font-medium text-slate-700">Items</p>
                <div className="mt-2 space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded border p-3">
                      <div>
                        <p className="font-medium text-slate-900">{item.productTitle}</p>
                        <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-slate-900">
                        {formatPrice(item.price * item.quantity, item.currency)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                  <span className="text-lg font-semibold text-slate-900">Total</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {formatPrice(selectedOrder.total, selectedOrder.currency)}
                  </span>
                </div>
              </div>
              {selectedOrder.notes && (
                <div>
                  <p className="font-medium text-slate-700">Notes</p>
                  <p className="text-slate-600">{selectedOrder.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

