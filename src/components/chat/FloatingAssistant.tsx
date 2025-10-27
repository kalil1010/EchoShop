'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { sendStylistMessage } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'

interface AssistantMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}

const PROMPTS = [
  'How do I upload closet items?',
  'Show me an example outfit plan.',
  'What does the color analyzer do?',
]

export function FloatingAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { toast } = useToast()
  const { user, userProfile } = useAuth()
  const normalisedRole = (userProfile?.role ?? user?.role)?.toLowerCase()

  if (normalisedRole === 'owner') {
    return null
  }

  const initialMessage = useMemo<AssistantMessage>(() => ({
    id: 'assistant-welcome',
    role: 'assistant',
    text: 'Need help getting started with ZMODA? I can walk you through the tour, uploading closet items, or styling tips. Just type a question or use a quick prompt!',
  }), [])

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([initialMessage])
      setTimeout(() => textareaRef.current?.focus(), 150)
    }
  }, [isOpen, messages.length, initialMessage])

  const handlePrompt = async (prompt: string) => {
    setInput('')
    await handleSend(prompt)
  }

  const handleSend = async (textOverride?: string) => {
    const messageText = (textOverride ?? input).trim()
    if (!messageText) return
    const userMessage: AssistantMessage = { id: `user-${Date.now()}`, role: 'user', text: messageText }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await sendStylistMessage({ message: messageText, mode: 'assistant' })
      const assistantText = response.reply ?? response.response ?? "I'm here to help!"
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: assistantText },
      ])
    } catch (error) {
      console.error('Assistant chat failed', error)
      toast({ variant: 'error', title: 'Assistant unavailable', description: 'Please try again in a moment.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='pointer-events-none fixed bottom-6 right-4 z-[900] sm:bottom-8 sm:right-8'>
      {isOpen && (
        <div className='pointer-events-auto mb-4 w-[320px] max-w-[90vw] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl'>
          <header className='flex items-center justify-between bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 text-white'>
            <div className='flex items-center gap-2'>
              <Sparkles className='h-4 w-4' />
              <span className='text-sm font-semibold'>ZMODA Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className='rounded-full p-1 transition hover:bg-white/20'>
              <X className='h-4 w-4' />
            </button>
          </header>
          <div
            /* Restrict typing cursor to the assistant bubble while it is composing */
            className='flex max-h-[320px] flex-col gap-3 overflow-y-auto px-4 py-4 text-sm'
            data-typing={isLoading ? 'true' : undefined}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'assistant'
                  ? 'self-start rounded-2xl bg-slate-100 px-4 py-2 text-slate-700'
                  : 'self-end rounded-2xl bg-purple-600 px-4 py-2 text-white'}
              >
                {message.text}
              </div>
            ))}
            {isLoading && <div className='self-start rounded-2xl bg-slate-100 px-4 py-2 text-slate-500'>Let me think...</div>}
          </div>
          <div className='px-4 pb-4'>
            <div className='flex flex-wrap gap-2 pb-3'>
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePrompt(prompt)}
                  className='rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-purple-300 hover:bg-purple-50'
                >
                  {prompt}
                </button>
              ))}
            </div>
            <div className='flex items-end gap-2'>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder='Ask for help...'
                className='min-h-[60px] flex-1 resize-none rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-purple-500'
              />
              <Button
                size='icon'
                className='h-11 w-11 rounded-full bg-purple-600 hover:bg-purple-700'
                disabled={isLoading || !input.trim()}
                onClick={() => handleSend()}
              >
                <Send className='h-5 w-5' />
              </Button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className='pointer-events-auto inline-flex items-center gap-3 rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/40 transition hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400'
      >
        <MessageCircle className='h-5 w-5' />
        {isOpen ? 'Hide assistant' : 'Need help getting started?'}
      </button>
    </div>
  )
}

