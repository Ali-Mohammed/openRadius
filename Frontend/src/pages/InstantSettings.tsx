import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Settings2, Radio } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { instantApi } from '../lib/api'
import type { Instant } from '../lib/api'

export default function InstantSettings() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('sas-radius')

  const { data: instant, isLoading } = useQuery({
    queryKey: ['instant', id],
    queryFn: () => instantApi.getById(Number(id)),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!instant) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Instant Not Found</h1>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{instant.title}</h1>
          <div
            className="h-6 w-6 rounded border"
            style={{ backgroundColor: instant.color }}
          />
        </div>
        <p className="text-muted-foreground mt-1">{instant.name} - {instant.location}</p>
      </div>

      <div className="grid gap-6">
        {/* Settings Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Integration Settings
            </CardTitle>
            <CardDescription>
              Configure integrations and settings for this instant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant={activeTab === 'sas-radius' ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => setActiveTab('sas-radius')}
            >
              <Radio className="h-4 w-4 mr-2" />
              SAS Radius 4 Integration
            </Button>
          </CardContent>
        </Card>

        {/* SAS Radius 4 Integration */}
        {activeTab === 'sas-radius' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                SAS Radius 4 Integration
              </CardTitle>
              <CardDescription>
                Configure SAS Radius 4 integration settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  SAS Radius 4 integration configuration will be available here.
                </p>
                <div className="rounded-lg border p-4 bg-muted/50">
                  <p className="text-sm font-medium mb-2">Coming Soon</p>
                  <p className="text-sm text-muted-foreground">
                    Configure your SAS Radius 4 server connection, authentication methods, 
                    and synchronization settings.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
