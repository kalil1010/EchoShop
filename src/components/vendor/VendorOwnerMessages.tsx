'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Send, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react'

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
  created_at: string
  updated_at: string
}

interface Conversation {
  id: string
  messages: Message[]
  lastMessage: Message | null
  unreadCount: number
  participantId: string
  participantName: string
}

export default function VendorOwnerMessages() {
  const { userProfile } = useAuth()
  const { toast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const vendorName = userProfile?.vendorBusinessName || userProfile?.displayName || 'Vendor'

  useEffect(() => {
    loadConversations()
  }, [])

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
      const response = await fetch('/api/vendor/messages', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to load messages')
      }

      const data = await response.json()
      setConversations(data.conversations || [])

      // Auto-select first conversation if available
      if (data.conversations && data.conversations.length > 0 && !selectedConversation) {
        setSelectedConversation(data.conversations[0])
      }
    } catch (error) {
      toast({
        title: 'Failed to load messages',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadConversationMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/vendor/messages?conversationId=${conversationId}`, {
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
      await fetch(`/api/vendor/messages/${messageId}/read`, {
        method: 'PATCH',
        credentials: 'include',
      })
    } catch (error) {
      console.warn('Failed to mark message as read:', error)
    }
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter a message.',
        variant: 'error',
      })
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/vendor/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject: subject.trim() || null,
          message: message.trim(),
          conversationId: selectedConversation?.id || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send message')
      }

      const data = await response.json()
      setMessage('')
      setSubject('')

      // Reload conversations to show new message
      await loadConversations()
      if (selectedConversation) {
        await loadConversationMessages(selectedConversation.id)
      }

      toast({
        title: 'Message sent',
        description: 'Your message has been sent to the owner.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Failed to send message',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      })
    } finally {
      setSending(false)
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
      {/* Conversations List */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">Messages</CardTitle>
          <CardDescription>Communicate with the owner</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {conversations.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No messages yet</p>
          ) : (
            conversations.map((conv) => (
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
                    <p className="font-medium text-sm text-slate-800 truncate">
                      {conv.participantName}
                    </p>
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
            ))
          )}
        </CardContent>
      </Card>

      {/* Messages View */}
      <Card className="md:col-span-2 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800">
            {selectedConversation ? `Conversation with ${selectedConversation.participantName}` : 'Select a conversation'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          {selectedConversation ? (
            <>
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
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {msg.subject && (
                          <p className={`font-semibold text-sm mb-1 ${isFromMe ? 'text-emerald-50' : 'text-slate-700'}`}>
                            {msg.subject}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <div className={`flex items-center gap-2 mt-2 text-xs ${isFromMe ? 'text-emerald-100' : 'text-slate-500'}`}>
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
                <Input
                  placeholder="Subject (optional)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                />
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    rows={3}
                    maxLength={2000}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={sending || !message.trim()}>
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
                <p className="text-slate-500">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

