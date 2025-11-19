'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Users, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface CommunityCardProps {
  community: {
    id: string
    name: string
    description?: string
    coverImage?: string
    memberCount: number
    postCount: number
    creator?: {
      id: string
      displayName?: string
      photoURL?: string
    }
  }
}

export function CommunityCard({ community }: CommunityCardProps) {
  return (
    <Link href={`/communities/${community.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        {community.coverImage && (
          <div className="relative h-32 w-full bg-gray-200 rounded-t-lg overflow-hidden">
            <Image
              src={community.coverImage}
              alt={community.name}
              fill
              className="object-cover"
            />
          </div>
        )}
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg mb-2">{community.name}</h3>
          {community.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{community.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{community.memberCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>{community.postCount}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

