'use client'

import React, { createContext, useContext, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export type Toast = {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastContextType = {
  toast: (t: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  const toast = (t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    const duration = t.duration ?? 3000
    const next: Toast = { id, ...t }
    setToasts((prev) => [...prev, next])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }

  const value = useMemo(() => ({ toast, dismiss }), [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[120] flex flex-col gap-2 sm:top-20">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto w-80 max-w-[90vw] rounded-md border bg-card p-3 text-card-foreground shadow',
            t.variant === 'success' && 'border-green-200 bg-green-50 text-green-800',
            t.variant === 'error' && 'border-red-200 bg-red-50 text-red-800',
            t.variant === 'warning' && 'border-yellow-200 bg-yellow-50 text-yellow-800'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="pr-3">
              {t.title && <div className="font-medium text-sm">{t.title}</div>}
              {t.description && <div className="text-sm opacity-90 mt-0.5">{t.description}</div>}
            </div>
            <button
              className="text-sm opacity-60 hover:opacity-100"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
