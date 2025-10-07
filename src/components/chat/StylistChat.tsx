'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { getUserClothing, toClosetSummary, type ClosetItemSummary } from '@/lib/closet'
import { isPermissionError } from '@/lib/security'
import { sendStylistMessage } from '@/lib/api'
import { MessageCircle, Sparkles, ImagePlus, X } from 'lucide-react'
import { analyzeImageColors } from '@/lib/imageAnalysis'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  imagePreviewUrl?: string
}

export function StylistChat() {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const [closetItems, setClosetItems] = useState<ClosetItemSummary[]>([])
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hi! I'm ZMODA AI, your personal fashion assistant. I can help with outfit ideas, styling tips, color coordination, and closet questions. What would you like to explore today?",
      isUser: false,
      timestamp: new Date(),
    }
  ])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedImage, setAttachedImage] = useState<{ preview: string; colors: string[] } | null>(null)

  const scrollToBottom = () => {
    const container = scrollContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    let active = true

    const loadCloset = async () => {
      if (!user?.uid) {
        if (active) setClosetItems([])
        return
      }
      try {
        const items = await getUserClothing(user.uid)
        if (active) setClosetItems(toClosetSummary(items, 20))
      } catch (error) {
        console.warn('Failed to load closet summary for chat:', error)
        if (active) {
          if (isPermissionError(error)) {
            toast({
              variant: 'error',
              title: error.reason === 'auth' ? 'Session expired' : 'Access denied',
              description:
                error.reason === 'auth'
                  ? 'Please sign in again to sync your closet with chat.'
                  : 'We could not access your closet for chat context.',
            })
          } else {
            toast({ variant: 'error', title: 'Closet unavailable', description: 'Continuing chat without closet context.' })
          }
          setClosetItems([])
        }
      }
    }

    loadCloset()
    return () => {
      active = false
    }
  }, [user?.uid])

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
      imagePreviewUrl: attachedImage?.preview,
    }

    setMessages(prev => [...prev, userMessage])
    setLoading(true)

    try {
      const response = await sendStylistMessage({
        message: content,
        context: messages.slice(-5).map(m => `${m.isUser ? 'User' : 'Assistant'}: ${m.content}`).join('\n'),
        imageColors: attachedImage?.colors,
        userProfile: userProfile || undefined,
        closetItems: closetItems.length > 0 ? closetItems : undefined,
      })

      const messageText = response.reply ?? response.response ?? ''
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: messageText,
        isUser: false,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({ variant: 'error', title: 'Message failed', description: 'Please try sending your message again.' })
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setAttachedImage(null)
    }
  }

  const onPickImage = () => fileInputRef.current?.click()
  const onImageSelected = async (file?: File) => {
    if (!file) return
    try {
      const analysis = await analyzeImageColors(file, 'enhanced')
      const preview = URL.createObjectURL(file)
      setAttachedImage({ preview, colors: analysis.dominantColors })
    } catch (e) {
      console.error('Image analysis failed:', e)
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center">
          <MessageCircle className="mr-2 h-5 w-5" />
          ZMODA AI Chat
        </CardTitle>
        <CardDescription>
          Get personalized fashion advice and styling tips from ZMODA AI
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex flex-col gap-4 flex-1">
        <div
          ref={scrollContainerRef}
          className="space-y-4 mb-4 pr-2"
          style={{ minHeight: '12rem', maxHeight: '60vh', overflowY: 'auto' }}
        >
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.content}
              isUser={message.isUser}
              timestamp={message.timestamp}
              imagePreviewUrl={message.imagePreviewUrl}
            />
          ))}
          {loading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-sm">ZMODA AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {attachedImage && (
          <div className="flex items-center gap-3 mb-2">
            <img src={attachedImage.preview} className="h-14 w-14 object-cover rounded" />
            <div className="text-xs text-gray-600">Attached image. Dominant colors: {attachedImage.colors.join(', ')}</div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="ml-auto inline-flex items-center justify-center w-7 h-7 rounded-full border text-gray-700 hover:bg-gray-50"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPickImage}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md border hover:bg-gray-50"
            title="Attach image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onImageSelected(e.target.files?.[0] || undefined)}
          />
          <div className="flex-1">
            <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

