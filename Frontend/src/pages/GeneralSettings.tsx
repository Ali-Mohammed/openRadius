import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Save, Users } from 'lucide-react'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function GeneralSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  const [currency, setCurrency] = useState('USD')
  const [churnDays, setChurnDays] = useState(20)

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['general-settings', currentWorkspaceId],
    queryFn: () => settingsApi.getGeneralSettings(currentWorkspaceId!),
    enabled: currentWorkspaceId !== null,
  })

  // Update local state when data changes
  useEffect(() => {
    if (settingsData) {
      setCurrency(settingsData.currency)
      setChurnDays(settingsData.churnDays)
    }
  }, [settingsData])

  const updateMutation = useMutation({
    mutationFn: (settings: { currency: string; churnDays: number }) => 
      settingsApi.updateGeneralSettings(currentWorkspaceId!, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['general-settings', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['workspace', currentWorkspaceId] })
      toast.success('Settings saved successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to save settings')
    },
  })

  const handleSave = () => {
    updateMutation.mutate({ currency, churnDays })
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

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="radius-user">Radius User</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="radius-user" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Churn User Settings
              </CardTitle>
              <CardDescription>Configure when a user is considered churned</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="churn-days">Number of days for user to become churn user</Label>
                <Input
                  id="churn-days"
                  type="number"
                  min="1"
                  value={churnDays}
                  onChange={(e) => setChurnDays(parseInt(e.target.value) || 20)}
                  className="max-w-xs"
                />
                <p className="text-sm text-muted-foreground">
                  A user will be marked as churned after {churnDays} days of inactivity
                </p>
              </div>

              <div className="pt-4">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
