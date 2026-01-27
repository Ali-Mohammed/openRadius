import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DollarSign, Save, ExternalLink, Activity, Briefcase } from 'lucide-react'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { Separator } from '@/components/ui/separator'

interface CompanyInfoTabProps {
  currency: string
  churnDays: number
  dateFormat: string
  onCurrencyChange: (value: string) => void
  onChurnDaysChange: (value: number) => void
  onDateFormatChange: (value: string) => void
  currentWorkspaceId: number | null
}

export default function CompanyInfoTab({
  currency,
  churnDays,
  dateFormat,
  onCurrencyChange,
  onChurnDaysChange,
  onDateFormatChange,
  currentWorkspaceId,
}: CompanyInfoTabProps) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (data: any) => settingsApi.updateGeneralSettings(currentWorkspaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-settings', currentWorkspaceId] })
      toast.success('Settings updated successfully')
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const handleSave = () => {
    if (currentWorkspaceId === null) return
    updateMutation.mutate({
      currency,
      churnDays,
      dateFormat,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Company Information
        </CardTitle>
        <CardDescription>
          Configure your company settings and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <RadioGroup value={currency} onValueChange={onCurrencyChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="USD" id="usd" />
              <Label htmlFor="usd" className="font-normal">USD - US Dollar</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="IQD" id="iqd" />
              <Label htmlFor="iqd" className="font-normal">IQD - Iraqi Dinar</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="churnDays">Churn Days</Label>
          <Input
            id="churnDays"
            type="number"
            value={churnDays}
            onChange={(e) => onChurnDaysChange(parseInt(e.target.value))}
            min={1}
          />
          <p className="text-sm text-muted-foreground">
            Number of days after which a customer is considered churned
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateFormat">Date Format</Label>
          <RadioGroup value={dateFormat} onValueChange={onDateFormatChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="MM/DD/YYYY" id="mdy" />
              <Label htmlFor="mdy" className="font-normal">MM/DD/YYYY</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="DD/MM/YYYY" id="dmy" />
              <Label htmlFor="dmy" className="font-normal">DD/MM/YYYY</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="YYYY-MM-DD" id="ymd" />
              <Label htmlFor="ymd" className="font-normal">YYYY-MM-DD</Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Development Tools</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Access logging and background job monitoring tools
            </p>
          </div>

          <div className="grid gap-3">
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open('http://localhost:5341', '_blank')}
            >
              <Activity className="mr-2 h-4 w-4" />
              Seq Logs
              <ExternalLink className="ml-auto h-4 w-4 opacity-50" />
            </Button>
            <p className="text-sm text-muted-foreground -mt-2 ml-10">
              View structured application logs and diagnostics
            </p>

            <Button
              variant="outline"
              className="justify-start"
              onClick={() => window.open('http://localhost:5000/hangfire', '_blank')}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Hangfire Dashboard
              <ExternalLink className="ml-auto h-4 w-4 opacity-50" />
            </Button>
            <p className="text-sm text-muted-foreground -mt-2 ml-10">
              Monitor and manage background jobs and scheduled tasks
            </p>
          </div>
        </div>

        <Separator />

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  )
}
