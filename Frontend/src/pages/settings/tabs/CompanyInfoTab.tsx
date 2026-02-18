import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, Save } from 'lucide-react'
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
          <Building2 className="h-5 w-5" />
          Company Information
        </CardTitle>
        <CardDescription>
          Configure your company details, currency, and display preferences
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

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  )
}
