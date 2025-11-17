'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageTemplates } from './MessageTemplates'
import { BroadcastMessaging } from './BroadcastMessaging'
import { VendorSegments } from './VendorSegments'
import { Mail, Send, Users } from 'lucide-react'

type Tab = 'templates' | 'broadcast' | 'segments'

export function CommunicationHub() {
  const [activeTab, setActiveTab] = useState<Tab>('templates')

  const tabs = [
    { key: 'templates' as Tab, label: 'Templates', icon: Mail },
    { key: 'broadcast' as Tab, label: 'Broadcast', icon: Send },
    { key: 'segments' as Tab, label: 'Segments', icon: Users },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'default' : 'outline'}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'templates' && <MessageTemplates />}
          {activeTab === 'broadcast' && <BroadcastMessaging />}
          {activeTab === 'segments' && <VendorSegments />}
        </CardContent>
      </Card>
    </div>
  )
}

