'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/toast'
import { getUserClothing, toClosetSummary, type ClosetItemSummary } from '@/lib/closet'
import { isPermissionError } from '@/lib/security'
import { sendStylistMessage, type StylistMessageResponse } from '@/lib/api'
import { MessageCircle, Sparkles, ImagePlus, X } from 'lucide-react'

const OUTFIT_KEYWORDS = [
  'outfit',
  'wear',
  'look',
  'attire',
  'ensemble',
  'garment',
  'style me',
  'dress me',
  'suit',
  'what should i wear',
  'put together',
  'coordinate',
  'suggest',
  'recommend',
  'styling idea',
]

type AnalyzeImageResponse = {
  description?: string
  colors?: Array<{ name?: string; hex?: string }>
  advice?: { summary?: string }
}

interface Message {
  id: string
  type: 'text' | 'image'
  content?: string
  caption?: string
  imageUrl?: string
  isUser: boolean
  timestamp: Date
  imagePreviewUrl?: string
}

const isLikelyOutfitRequest = (value: string): boolean => {
  const text = value.toLowerCase().trim()
  if (!text) return false
  if (/what should i wear|show me (an )?outfit|suggest (an )?outfit|outfit idea|outfit for/.test(text)) {
    return true
  }
  if (text.includes('outfit') || text.includes('what to wear')) {
    return true
  }
  const hasDirective = /(?:show|suggest|recommend|create|build|plan|put together|style|dress)\b/.test(text)
  const hasKeyword = OUTFIT_KEYWORDS.some((keyword) => text.includes(keyword))
  return hasDirective && hasKeyword
}

const summariseMessageForContext = (message: Message): string => {
  const role = message.isUser ? 'User' : 'Assistant'
  const parts: string[] = []
  if (message.content) parts.push(message.content)
  if (!message.content && message.caption) parts.push(message.caption)
  if (!parts.length && message.type === 'image') parts.push('[image]')
  const payload = parts.join(' ').trim()
  return payload ? `${role}: ${payload}` : `${role}:`
}

const extractAssistantText = (payload: StylistMessageResponse): string => {
  return payload.text ?? payload.reply ?? payload.response ?? ''
}

export function StylistChat() {
  const { user, userProfile } = useAuth()
  const { toast } = useToast()
  const [closetItems, setClosetItems] = useState<ClosetItemSummary[]>([])

  const firstName = useMemo(() => {
    const source = userProfile?.displayName || user?.displayName || user?.email || ''
    if (!source) return 'there'
    const cleaned = source.includes('@') ? source.split('@')[0] : source
    const trimmed = cleaned.trim()
    if (!trimmed) return 'there'
    return trimmed.split(/\s+/)[0]
  }, [userProfile?.displayName, user?.displayName, user?.email])

  const greetingText = useMemo(() => {
    const isKnown = firstName && firstName.toLowerCase() !== 'there'
    const base = isKnown ? firstName : 'there'
    const normalized = isKnown ? base.charAt(0).toUpperCase() + base.slice(1) : 'there'
    return `Hi ${normalized}! I'm ZMODA AI, your personal fashion assistant. I can help with outfit ideas, styling tips, color coordination, and closet questions. What would you like to explore today?`
  }, [firstName])

  const [messages, setMessages] = useState<Message[]>(() => ([
    {
      id: 'assistant-welcome',
      type: 'text',
      content: greetingText,
      isUser: false,
      timestamp: new Date(),
    },
  ]))

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length) {
        return [{
          id: 'assistant-welcome',
          type: 'text',
          content: greetingText,
          isUser: false,
          timestamp: new Date(),
        }]
      }
      const [first, ...rest] = prev
      if (first.isUser) {
        return prev
      }
      if (first.content === greetingText) {
        return prev
      }
      return [{ ...first, content: greetingText, timestamp: new Date() }, ...rest]
    })
  }, [greetingText])

  const [loadingState, setLoadingState] = useState<'idle' | 'text' | 'image'>('idle')
  const isLoading = loadingState !== 'idle'
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileToDataUrl = useCallback((input: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(input)
  }), [])
  const [attachedImage, setAttachedImage] = useState<{ preview: string; colors: string[]; description?: string; summary?: string } | null>(null)

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
  }, [toast, user?.uid])

  const handleSendMessage = async (rawContent: string) => {
    const trimmed = rawContent.trim()
    if (!trimmed) {
      return
    }

    const pendingAttachment = attachedImage
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'text',
      content: trimmed,
      isUser: true,
      timestamp: new Date(),
      imagePreviewUrl: pendingAttachment?.preview,
    }

    setMessages((prev) => [...prev, userMessage])
    setLoadingState(isLikelyOutfitRequest(trimmed) ? 'image' : 'text')

    try {
      const contextSnippet = messages
        .slice(-5)
        .map((msg) => summariseMessageForContext(msg))
        .join('\n')

      const response = await sendStylistMessage({
        message: trimmed,
        context: contextSnippet,
        imageColors: pendingAttachment?.colors,
        imageDescription: pendingAttachment?.description,
        userProfile: userProfile || undefined,
        closetItems: closetItems.length > 0 ? closetItems : undefined,
      })

      const assistantText = extractAssistantText(response)
      const caption = response.caption || (response.type === 'image' ? assistantText : undefined)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: response.type === 'image' && response.imageUrl ? 'image' : 'text',
        content: assistantText || undefined,
        caption,
        imageUrl: response.imageUrl,
        isUser: false,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (response.error === 'image_generation_failed') {
        toast({ variant: 'warning', title: 'Image unavailable', description: 'I shared the outfit details, but the image could not be generated. Please try again.' })
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      toast({ variant: 'error', title: 'Message failed', description: 'Please try sending your message again.' })
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'text',
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoadingState('idle')
      setAttachedImage(null)
    }
  }

  const onPickImage = () => fileInputRef.current?.click()
  const onImageSelected = async (file?: File) => {
    if (!file) return
    try {
      const dataUrl = await fileToDataUrl(file)
      const profilePayload = userProfile
        ? {
            gender: userProfile.gender ?? undefined,
            age: userProfile.age ?? undefined,
            favoriteColors: userProfile.favoriteColors ?? [],
            dislikedColors: userProfile.dislikedColors ?? [],
            stylePreferences: userProfile.favoriteStyles ?? [],
          }
        : undefined
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, profile: profilePayload }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(typeof body?.error === 'string' ? body.error : 'Image analysis failed')
      }
      const body = (await response.json()) as AnalyzeImageResponse
      const rawColors = Array.isArray(body.colors) ? body.colors : []
      const colors = rawColors
        .map((entry) => (typeof entry?.name === 'string' ? entry.name : null))
        .filter((name): name is string => Boolean(name))
      const description = typeof body.description === 'string' ? body.description : undefined
      const summary = typeof body?.advice?.summary === 'string' ? body.advice.summary : undefined
      const preview = URL.createObjectURL(file)
      setAttachedImage({ preview, colors, description, summary })
    } catch (error) {
      console.error('Image analysis failed:', error)
      toast({ variant: 'error', title: 'Image analysis failed', description: 'We could not read the colors from that photo. Try another image?' })
    }
  }

  const loadingCopy = loadingState === 'image' ? 'ZMODA AI is styling your look...' : 'ZMODA AI is thinking...'

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
          data-typing={isLoading ? 'true' : undefined}
          ref={scrollContainerRef}
          className="space-y-4 mb-4 pr-2"
          style={{ minHeight: '12rem', maxHeight: '60vh', overflowY: 'auto' }}
        >
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              type={message.type}
              content={message.content ?? ''}
              caption={message.caption}
              imageUrl={message.imageUrl}
              isUser={message.isUser}
              timestamp={message.timestamp}
              imagePreviewUrl={message.imagePreviewUrl}
            />
          ))}
          {isLoading && (
            <div className="flex items-center space-x-2 text-gray-500">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span className="text-sm">{loadingCopy}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {attachedImage && (
          <div className="flex items-center gap-3 mb-2">
            <img src={attachedImage.preview} className="h-14 w-14 object-cover rounded" alt="attachment preview" />
            <div className="text-xs text-gray-600">
              Attached image. {attachedImage.summary ? `${attachedImage.summary} ` : ''}
              {attachedImage.colors.length
                ? `Dominant shades: ${attachedImage.colors.join(', ')}.`
                : 'Dominant shades: not clearly detected.'}
            </div>
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
            <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

