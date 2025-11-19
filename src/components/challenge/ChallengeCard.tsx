'use client'

import React from 'react'
import Link from 'next/link'
import { Calendar, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'

interface ChallengeCardProps {
  challenge: {
    id: string
    title: string
    description?: string
    coverImage?: string
    startDate: string
    endDate: string
    submissionCount: number
    creator?: {
      id: string
      displayName?: string
      photoURL?: string
    }
  }
}

export function ChallengeCard({ challenge }: ChallengeCardProps) {
  const endDate = new Date(challenge.endDate)
  const isEndingSoon = endDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 // 7 days

  return (
    <Link href={`/challenges/${challenge.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        {challenge.coverImage && (
          <div className="relative h-32 w-full bg-gray-200 rounded-t-lg overflow-hidden">
            <img
              src={challenge.coverImage}
              alt={challenge.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2">{challenge.title}</h3>
          {challenge.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{challenge.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {isEndingSoon ? 'Ends ' : 'Ends '}
                {formatDistanceToNow(endDate, { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{challenge.submissionCount} submissions</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

