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
  { id: 'pear', label: 'Pear', genders: ['female'] },
  { id: 'apple', label: 'Apple', genders: ['female'] },
]

type SilhouetteMetrics = {
  shoulder: number
  waist: number
  hip: number
  headRadius: number
  torsoLength: number
}

const SILHOUETTE_MAP: Record<BodyShapeId, SilhouetteMetrics> = {
  rectangle: { shoulder: 12, waist: 11, hip: 12, headRadius: 6, torsoLength: 44 },
  triangle: { shoulder: 9, waist: 11, hip: 15, headRadius: 6, torsoLength: 46 },
  'inverted-triangle': { shoulder: 15, waist: 11, hip: 9, headRadius: 6, torsoLength: 44 },
  oval: { shoulder: 13, waist: 15, hip: 13, headRadius: 6, torsoLength: 46 },
  trapezoid: { shoulder: 15, waist: 11, hip: 10, headRadius: 6, torsoLength: 46 },
  hourglass: { shoulder: 13, waist: 8, hip: 14, headRadius: 6, torsoLength: 44 },
  pear: { shoulder: 10, waist: 9, hip: 15, headRadius: 6, torsoLength: 46 },
  apple: { shoulder: 13, waist: 16, hip: 13, headRadius: 6, torsoLength: 44 },
}

const getFillColor = (selected: boolean) => (selected ? '#7c3aed' : '#c4d2f7')
const getStrokeColor = (selected: boolean) => (selected ? '#5b21b6' : '#475569')

const buildTorsoPath = ({ shoulder, waist, hip, torsoLength }: SilhouetteMetrics) => {
  const neckY = 22
  const waistY = neckY + torsoLength * 0.45
  const hipY = neckY + torsoLength * 0.75
  const hemY = neckY + torsoLength

  return `
    M ${40 - shoulder} ${neckY}
    Q 40 ${neckY - 4} ${40 + shoulder} ${neckY}
    C ${40 + shoulder} ${neckY + 8} ${40 + waist} ${waistY - 6} ${40 + waist} ${waistY}
    C ${40 + waist} ${waistY + 8} ${40 + hip} ${hipY - 2} ${40 + hip} ${hipY}
    Q ${40 + hip} ${hipY + 10} 40 ${hemY}
    Q ${40 - hip} ${hipY + 10} ${40 - hip} ${hipY}
    C ${40 - hip} ${hipY - 2} ${40 - waist} ${waistY + 8} ${40 - waist} ${waistY}
    C ${40 - waist} ${waistY - 6} ${40 - shoulder} ${neckY + 8} ${40 - shoulder} ${neckY}
    Z
  `
}

const BodyShapeIllustration: React.FC<{ shape: BodyShapeId; selected: boolean }> = ({ shape, selected }) => {
  const fill = getFillColor(selected)
  const stroke = getStrokeColor(selected)
  const metrics = SILHOUETTE_MAP[shape]
  const torsoPath = buildTorsoPath(metrics)

  return (
    <svg viewBox="0 0 80 80" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={selected ? '#a855f7' : '#dbe7ff'} />
          <stop offset="100%" stopColor={selected ? '#7c3aed' : '#b6c6f2'} />
        </linearGradient>
      </defs>
      <circle
        cx="40"
        cy="16"
        r={metrics.headRadius}
        fill="url(#bodyGradient)"
        stroke={stroke}
        strokeWidth="2"
      />
      <path d={torsoPath} fill="url(#bodyGradient)" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M34 28 C33 35 33 47 32 60"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M46 28 C47 35 47 47 48 60"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  )
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
            title={option.label}
            onClick={() => onChange(selected ? '' : option.id)}
            className={cn(
              'flex flex-col items-center rounded-xl border p-3 text-xs font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1',
              selected
                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md shadow-purple-100'
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
