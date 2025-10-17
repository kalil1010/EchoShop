'use client'

import React, { useMemo } from 'react'

import type { UserProfile } from '@/types/user'
import { cn } from '@/lib/utils'

export type BodyShapeId =
  | 'rectangle'
  | 'triangle'
  | 'inverted-triangle'
  | 'oval'
  | 'trapezoid'
  | 'hourglass'
  | 'pear'
  | 'apple'

type GenderKey = Exclude<UserProfile['gender'], undefined> | 'any'

type BodyShapeOption = {
  id: BodyShapeId
  label: string
  genders: GenderKey[]
}

const BODY_SHAPE_OPTIONS: BodyShapeOption[] = [
  { id: 'rectangle', label: 'Rectangle', genders: ['male', 'female', 'other'] },
  { id: 'triangle', label: 'Triangle', genders: ['male'] },
  { id: 'inverted-triangle', label: 'Inverted Triangle', genders: ['male', 'female'] },
  { id: 'oval', label: 'Oval', genders: ['male'] },
  { id: 'trapezoid', label: 'Trapezoid', genders: ['male'] },
  { id: 'hourglass', label: 'Hourglass', genders: ['female'] },
  { id: 'pear', label: 'Pear (Triangle)', genders: ['female'] },
  { id: 'apple', label: 'Apple (Round)', genders: ['female'] },
]

const getFillColor = (selected: boolean) => (selected ? '#8b5cf6' : '#cbd5f5')
const getStrokeColor = (selected: boolean) => (selected ? '#6d28d9' : '#475569')

const BodyShapeIllustration: React.FC<{ shape: BodyShapeId; selected: boolean }> = ({ shape, selected }) => {
  const fill = getFillColor(selected)
  const stroke = getStrokeColor(selected)

  switch (shape) {
    case 'rectangle':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <rect x="24" y="12" width="32" height="56" rx="12" fill={fill} stroke={stroke} strokeWidth="2.5" />
        </svg>
      )
    case 'triangle':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <polygon points="40,12 64,68 16,68" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )
    case 'inverted-triangle':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <polygon points="16,12 64,12 40,68" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )
    case 'oval':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <ellipse cx="40" cy="40" rx="18" ry="26" fill={fill} stroke={stroke} strokeWidth="2.5" />
        </svg>
      )
    case 'trapezoid':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <polygon points="24,18 56,18 64,62 16,62" fill={fill} stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      )
    case 'hourglass':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <path
            d="M24 16h32c0 12-12 18-12 24s12 12 12 24H24c0-12 12-18 12-24S24 28 24 16Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.5"
          />
        </svg>
      )
    case 'pear':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <path
            d="M40 18c-3 0-6 3-7 8-9 2-15 10-15 20 0 12 9 22 22 22s22-10 22-22c0-10-6-18-15-20-1-5-4-8-7-8Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="2.5"
          />
        </svg>
      )
    case 'apple':
      return (
        <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
          <circle cx="40" cy="42" r="22" fill={fill} stroke={stroke} strokeWidth="2.5" />
          <path d="M39 16c3 4 8 4 12 0" stroke={stroke} strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      )
    default:
      return null
  }
}

export const getBodyShapeOptionsForGender = (gender?: UserProfile['gender']) => {
  if (!gender || gender === 'other') {
    return BODY_SHAPE_OPTIONS
  }
  return BODY_SHAPE_OPTIONS.filter((option) => option.genders.includes(gender))
}

interface BodyShapeSelectorProps {
  gender?: UserProfile['gender']
  value?: string
  onChange: (value: string | '') => void
}

export const BodyShapeSelector: React.FC<BodyShapeSelectorProps> = ({ gender, value, onChange }) => {
  const options = useMemo(() => getBodyShapeOptionsForGender(gender), [gender])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((option) => {
        const selected = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(selected ? '' : option.id)}
            className={cn(
              'flex flex-col items-center rounded-xl border p-3 text-xs font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
              selected
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50/60'
            )}
            aria-pressed={selected}
            aria-label={option.label}
          >
            <span className="mb-2 flex h-20 w-20 items-center justify-center rounded-full bg-slate-50">
              <BodyShapeIllustration shape={option.id} selected={selected} />
            </span>
            <span className="text-center leading-tight">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { BODY_SHAPE_OPTIONS }
