import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { DollarSign, Save } from 'lucide-react'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function GeneralSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  const [currency, setCurrency] = useState('USD')

  const { isLoading } = useQuery({
    queryKey: ['general-settings', currentWorkspaceId],
    queryFn: () => settingsApi.getGeneralSettings(currentWorkspaceId!),
    enabled: currentWorkspaceId !== null, // Only fetch when workspace ID is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent duplicate requests
    onSuccess: (data) => {
      setCurrency(data.currency)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (currency: string) => settingsApi.updateGeneralSettings(currentWorkspaceId!, { currency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-settings', currentWorkspaceId] })
      toast.success('Settings saved successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to save settings')
    },
  })

  const handleSave = () => {
    updateMutation.mutate(currency)
  }

  if (isLoadingWorkspace || isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">General Settings</h1>
        <p className="text-muted-foreground">Configure general workspace preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency
          </CardTitle>
          <CardDescription>Select the currency for this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={currency} onValueChange={setCurrency}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="USD" id="usd" />
              <Label htmlFor="usd" className="flex items-center gap-2 cursor-pointer">
                <span className="text-lg">$</span>
                US Dollar (USD)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="IQD" id="iqd" />
              <Label htmlFor="iqd" className="flex items-center gap-2 cursor-pointer">
                <span className="text-lg">د.ع</span>
                Iraqi Dinar (IQD)
              </Label>
            </div>
          </RadioGroup>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
