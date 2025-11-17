'use client'

import React, { useEffect, useState, useRef } from 'react'
import {
  Send,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Filter,
  Search,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  recipient_id: string
  subject: string | null
  message: string
  is_read: boolean
  read_at: string | null
  ticket_status: 'open' | 'in_progress' | 'resolved' | 'closed'
  ticket_priority: 'low' | 'normal' | 'high' | 'urgent'
  ticket_category: string | null
  created_at: string
  updated_at: string
}

interface Conversation {
  id: string
  messages: Message[]
  lastMessage: Message | null
  unreadCount: number
  vendorId: string
  vendorName: string
  ticketStatus: 'open' | 'in_progress' | 'resolved' | 'closed'
  ticketPriority: 'low' | 'normal' | 'high' | 'urgent'
  ticketCategory: string | null
}

const PRIORITY_COLORS = {
  low: 'text-slate-600 bg-slate-50 border-slate-200',
  normal: 'text-blue-600 bg-blue-50 border-blue-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  urgent: 'text-red-600 bg-red-50 border-red-200',
}

const STATUS_COLORS = {
  open: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  in_progress: 'text-blue-600 bg-blue-50 border-blue-200',
  resolved: 'text-slate-600 bg-slate-50 border-slate-200',
  closed: 'text-slate-400 bg-slate-50 border-slate-200',
}

const STATUS_ICONS = {
  open: AlertCircle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: XCircle,
}

export default function OwnerSupportTickets() {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    if (selectedConversation) {
      scrollToBottom()
      // Mark messages as read
      selectedConversation.messages
        .filter((m) => !m.is_read && m.recipient_id === userProfile?.uid)
        .forEach((m) => markAsRead(m.id))
    }
  }, [selectedConversation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadConversations = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter)
      }

      const response = await fetch(`/api/admin/support/tickets?${params.toString()}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load tickets')
      }

      const data = await response.json()
      let filtered = data.conversations || []

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(
          (conv: Conversation) =>
            conv.vendorName.toLowerCase().includes(query) ||
            conv.lastMessage?.subject?.toLowerCase().includes(query) ||
            conv.lastMessage?.message?.toLowerCase().includes(query),
        )
      }

      setConversations(filtered)

      // Auto-select first conversation if available and none selected
      if (filtered.length > 0 && !selectedConversation) {
        setSelectedConversation(filtered[0])
        loadConversationMessages(filtered[0].id)
      }
    } catch (error) {
      toast({
        title: 'Failed to load tickets',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/admin/support/tickets?conversationId=${conversationId}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load messages')
      }

      const data = await response.json()
      const conversation = conversations.find((c) => c.id === conversationId)
      if (conversation) {
        conversation.messages = data.messages || []
        setConversations([...conversations])
        setSelectedConversation(conversation)
      }
    } catch (error) {
      toast({
        title: 'Failed to load messages',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    }
  }

  const markAsRead = async (messageId: string) => {
    try {
      await fetch(`/api/admin/support/tickets/${messageId}/read`, {
        method: 'PATCH',
        credentials: 'include',
      })
    } catch (error) {
      console.warn('Failed to mark message as read:', error)
    }
  }

  const handleSendReply = async () => {
    if (!message.trim() || !selectedConversation) {
      toast({
        title: 'Message required',
        description: 'Please enter a message.',
        variant: 'error',
      })
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: message.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send reply')
      }

      setMessage('')

      // Reload conversations to show new message
      await loadConversations()
      if (selectedConversation) {
        await loadConversationMessages(selectedConversation.id)
      }

      toast({
        title: 'Reply sent',
        description: 'Your reply has been sent to the vendor.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to send reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setSending(false)
    }
  }

  const handleUpdateStatus = async (newStatus: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    if (!selectedConversation || updatingStatus) return

    setUpdatingStatus(true)
    try {
      const response = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          message: `Ticket status updated to ${newStatus.replace('_', ' ')}.`,
          ticketStatus: newStatus,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      // Reload conversations
      await loadConversations()
      if (selectedConversation) {
        await loadConversationMessages(selectedConversation.id)
      }

      toast({
        title: 'Status updated',
        description: `Ticket status changed to ${newStatus.replace('_', ' ')}.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to update status',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const filteredConversations = conversations.filter((conv) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        conv.vendorName.toLowerCase().includes(query) ||
        conv.lastMessage?.subject?.toLowerCase().includes(query) ||
        conv.lastMessage?.message?.toLowerCase().includes(query)
      )
    }
    return true
  })

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Tickets List */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Support Tickets</CardTitle>
          <CardDescription>Vendor support requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Tickets */}
          {filteredConversations.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No tickets found</p>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredConversations.map((conv) => {
                const StatusIcon = STATUS_ICONS[conv.ticketStatus]
                const statusColor = STATUS_COLORS[conv.ticketStatus]
                const priorityColor = PRIORITY_COLORS[conv.ticketPriority]

                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConversation(conv)
                      loadConversationMessages(conv.id)
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusIcon className="h-3 w-3" />
                          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor}`}>
                            {conv.ticketStatus.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${priorityColor}`}>
                            {conv.ticketPriority.toUpperCase()}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-slate-800 truncate">
                          {conv.vendorName}
                        </p>
                        {conv.lastMessage?.subject && (
                          <p className="text-xs text-slate-600 truncate mt-1">
                            {conv.lastMessage.subject}
                          </p>
                        )}
                        {conv.lastMessage && (
                          <p className="text-xs text-slate-500 truncate mt-1">
                            {conv.lastMessage.message.substring(0, 50)}
                            {conv.lastMessage.message.length > 50 ? '...' : ''}
                          </p>
                        )}
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 bg-emerald-500 text-white text-xs font-medium rounded-full px-2 py-0.5">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(conv.lastMessage.created_at)}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages View */}
      <Card className="md:col-span-2 flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                {selectedConversation
                  ? `Ticket from ${selectedConversation.vendorName}`
                  : 'Select a ticket'}
              </CardTitle>
              {selectedConversation && (
                <CardDescription>
                  {selectedConversation.lastMessage?.subject || 'Support Request'}
                </CardDescription>
              )}
            </div>
            {selectedConversation && (
              <div className="flex gap-2">
                <select
                  value={selectedConversation.ticketStatus}
                  onChange={(e) =>
                    handleUpdateStatus(e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed')
                  }
                  disabled={updatingStatus}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {selectedConversation ? (
            <>
              {/* Ticket Info */}
              <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Vendor:</span>
                    <span className="ml-2 font-medium">{selectedConversation.vendorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Category:</span>
                    <span className="ml-2 font-medium">
                      {selectedConversation.ticketCategory || 'Not specified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Priority:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${PRIORITY_COLORS[selectedConversation.ticketPriority]}`}>
                      {selectedConversation.ticketPriority.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Status:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selectedConversation.ticketStatus]}`}>
                      {selectedConversation.ticketStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {selectedConversation.messages.map((msg) => {
                  const isFromMe = msg.sender_id === userProfile?.uid
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isFromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {msg.subject && !isFromMe && (
                          <p className={`font-semibold text-sm mb-1 ${isFromMe ? 'text-blue-50' : 'text-slate-700'}`}>
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <div className={`flex items-center gap-2 mt-2 text-xs ${isFromMe ? 'text-blue-100' : 'text-slate-500'}`}>
                          <span>{formatDate(msg.created_at)}</span>
                          {isFromMe && msg.is_read && (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                    rows={3}
                    maxLength={2000}
                    className="flex-1"
                  />
                  <Button onClick={handleSendReply} disabled={sending || !message.trim()}>
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500 text-right">{message.length}/2000</p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center py-12">
              <div>
                <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Select a ticket to view messages</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

