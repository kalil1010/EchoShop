'use client'

import React, { useState, Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignUpForm } from '@/components/auth/SignUpForm'

function AuthContent() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const searchParams = useSearchParams()
  const timeout = searchParams.get('timeout')
  const reason = searchParams.get('reason')
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false)
  
  const toggleMode = () => setMode((m) => (m === 'login' ? 'signup' : 'login'))

  useEffect(() => {
    if (timeout === 'true') {
      setShowTimeoutMessage(true)
      // Hide the message after 10 seconds
      const timer = setTimeout(() => setShowTimeoutMessage(false), 10000)
      return () => clearTimeout(timer)
    }
  }, [timeout])

  return (
    <div className="container mx-auto px-4 py-8">
      {showTimeoutMessage && (
        <div className="max-w-md mx-auto mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-1">
                Session Timeout
              </h3>
              <p className="text-sm text-yellow-700">
                {reason === 'session_corrupted' 
                  ? 'Your session data became corrupted and has been cleared. Please sign in again.'
                  : 'Your session timed out. Please sign in again to continue.'
                }
              </p>
            </div>
            <button
              onClick={() => setShowTimeoutMessage(false)}
              className="text-yellow-600 hover:text-yellow-800"
              aria-label="Close message"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {mode === 'login' ? (
        <LoginForm onToggleMode={toggleMode} />
      ) : (
        <SignUpForm onToggleMode={toggleMode} />
      )}
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto" />
          <div className="h-96 bg-gray-200 rounded max-w-md mx-auto" />
        </div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
