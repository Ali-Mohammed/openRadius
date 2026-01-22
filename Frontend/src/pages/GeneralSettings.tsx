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
import { DollarSign, Save, Users, Tags, Loader2, Filter } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { apiClient } from '@/lib/api'
import * as signalR from '@microsoft/signalr'
import { QueryBuilder, type FilterGroup, type FilterColumn, filtersToQueryString } from '@/components/QueryBuilder'

export default function GeneralSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  const [currency, setCurrency] = useState('USD')
  const [churnDays, setChurnDays] = useState(20)
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<TagSyncProgress | null>(null)
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<FilterGroup | null>(null)
  const [appliedFilters, setAppliedFilters] = useState<FilterGroup | null>(null)

interface TagSyncProgress {
  phase: string
  current: number
  total: number
  percentComplete: number
  message: string
}

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
      setDateFormat(settingsData.dateFormat)
    }
  }, [settingsData])

  const updateMutation = useMutation({
    mutationFn: (settings: { currency: string; churnDays: number; dateFormat: string }) => 
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

  const filterColumns: FilterColumn[] = useMemo(() => [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'expiration', label: 'Expiration Date', type: 'date' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'lastOnline', label: 'Last Online', type: 'date' },
    { key: 'balance', label: 'Balance', type: 'number' },
  ], [])

  const handleSave = () => {
    updateMutation.mutate({ currency, churnDays, dateFormat })
  }

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters)
    setShowFilterBuilder(false)
  }

  const handleClearFilters = () => {
    setPendingFilters(null)
    setAppliedFilters(null)
    setShowFilterBuilder(false)
  }

  const handleSyncTags = async () => {
    let connection: signalR.HubConnection | null = null
    
    try {
      setIsSyncing(true)
      setSyncProgress({
        phase: 'Starting',
        current: 0,
        total: 0,
        percentComplete: 0,
        message: 'Initializing tag sync...'
      })

      // Connect to SignalR hub for progress updates
      connection = new signalR.HubConnectionBuilder()
        .withUrl(`${import.meta.env.VITE_API_URL}/hubs/tagsync`)
        .withAutomaticReconnect()
        .build()

      connection.on('TagSyncProgress', (progress: TagSyncProgress) => {
        setSyncProgress(progress)
      })

      connection.on('TagSyncError', (error: { message: string }) => {
        toast.error(`Tag Sync Error: ${error.message}`)
      })

      await connection.start()

      // Include filters in the request if applied
      const requestData = appliedFilters ? { filters: filtersToQueryString(appliedFilters) } : {}
      const response = await apiClient.post('/api/radius/tags/sync', requestData)
      
      toast.success(`Tag Sync Complete: Processed ${response.data.usersProcessed} users. Assigned ${response.data.tagsAssigned} tags, removed ${response.data.tagsRemoved} tags.`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync tags')
    } finally {
      if (connection) {
        await connection.stop()
      }
      setIsSyncing(false)
      setSyncProgress(null)
    }
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
          <TabsTrigger value="tag-sync">Tag Sync</TabsTrigger>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Date & Time Format
              </CardTitle>
              <CardDescription>Select the date and time format for this workspace</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="text-sm font-medium">Date Only</div>
                <RadioGroup value={dateFormat} onValueChange={setDateFormat}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MM/DD/YYYY" id="mm-dd-yyyy" />
                    <Label htmlFor="mm-dd-yyyy" className="flex items-center gap-2 cursor-pointer">
                      MM/DD/YYYY <span className="text-sm text-muted-foreground">(e.g., 01/12/2026)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DD/MM/YYYY" id="dd-mm-yyyy" />
                    <Label htmlFor="dd-mm-yyyy" className="flex items-center gap-2 cursor-pointer">
                      DD/MM/YYYY <span className="text-sm text-muted-foreground">(e.g., 12/01/2026)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="YYYY-MM-DD" id="yyyy-mm-dd" />
                    <Label htmlFor="yyyy-mm-dd" className="flex items-center gap-2 cursor-pointer">
                      YYYY-MM-DD <span className="text-sm text-muted-foreground">(e.g., 2026-01-12)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DD.MM.YYYY" id="dd-dot-mm-yyyy" />
                    <Label htmlFor="dd-dot-mm-yyyy" className="flex items-center gap-2 cursor-pointer">
                      DD.MM.YYYY <span className="text-sm text-muted-foreground">(e.g., 12.01.2026)</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="text-sm font-medium">Date with Time</div>
                <RadioGroup value={dateFormat} onValueChange={setDateFormat}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="MM/DD/YYYY HH:mm:ss" id="mm-dd-yyyy-time" />
                    <Label htmlFor="mm-dd-yyyy-time" className="flex items-center gap-2 cursor-pointer">
                      MM/DD/YYYY HH:mm:ss <span className="text-sm text-muted-foreground">(e.g., 01/12/2026 14:30:45)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DD/MM/YYYY HH:mm:ss" id="dd-mm-yyyy-time" />
                    <Label htmlFor="dd-mm-yyyy-time" className="flex items-center gap-2 cursor-pointer">
                      DD/MM/YYYY HH:mm:ss <span className="text-sm text-muted-foreground">(e.g., 12/01/2026 14:30:45)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="YYYY-MM-DD HH:mm:ss" id="yyyy-mm-dd-time" />
                    <Label htmlFor="yyyy-mm-dd-time" className="flex items-center gap-2 cursor-pointer">
                      YYYY-MM-DD HH:mm:ss <span className="text-sm text-muted-foreground">(e.g., 2026-01-12 14:30:45)</span>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DD.MM.YYYY HH:mm:ss" id="dd-dot-mm-yyyy-time" />
                    <Label htmlFor="dd-dot-mm-yyyy-time" className="flex items-center gap-2 cursor-pointer">
                      DD.MM.YYYY HH:mm:ss <span className="text-sm text-muted-foreground">(e.g., 12.01.2026 14:30:45)</span>
                    </Label>
                  </div>
                </RadioGroup>
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

        <TabsContent value="tag-sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                RADIUS Tag Sync
              </CardTitle>
              <CardDescription>
                Auto-assign tags to users based on their created date and expiration status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This will automatically assign tags like "New User", "Active", "Expired", and "Expiring Soon" 
                  based on user creation dates and expiration status.
                </p>
                
                {/* Filter Builder Toggle */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilterBuilder(!showFilterBuilder)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {appliedFilters ? 'Edit Filters' : 'Add Filters'}
                    </Button>
                    {appliedFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  {appliedFilters && (
                    <span className="text-sm text-muted-foreground">
                      Filters applied - only matching users will be synced
                    </span>
                  )}
                </div>

                {/* Query Builder */}
                {showFilterBuilder && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <QueryBuilder
                      columns={filterColumns}
                      value={pendingFilters}
                      onChange={setPendingFilters}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleApplyFilters}>
                        Apply Filters
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowFilterBuilder(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {syncProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{syncProgress.message}</span>
                      <span className="font-medium">{syncProgress.percentComplete}%</span>
                    </div>
                    <Progress value={syncProgress.percentComplete} className="h-2" />
                  </div>
                )}
              </div>
              <Button 
                onClick={handleSyncTags} 
                disabled={isSyncing}
                className="w-full sm:w-auto"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing Tags...
                  </>
                ) : (
                  <>
                    <Tags className="mr-2 h-4 w-4" />
                    Sync Tags
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
