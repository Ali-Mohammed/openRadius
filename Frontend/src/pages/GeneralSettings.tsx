import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Save, Users, Tags, Loader2, Filter, Plus, Trash2, Edit2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { apiClient } from '@/lib/api'
import * as signalR from '@microsoft/signalr'
import { QueryBuilder, type FilterGroup, type FilterColumn } from '@/components/QueryBuilder'
import { radiusTagApi } from '@/api/radiusTagApi'
import { type RadiusProfile } from '@/api/radiusProfileApi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getIconComponent } from '@/utils/iconColorHelper'

interface TagSyncProgress {
  phase: string
  current: number
  total: number
  percentComplete: number
  message: string
}

interface TagSyncRule {
  id: string
  tagId: number
  tagName: string
  filterGroup: FilterGroup | null
}

export default function GeneralSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currency, setCurrency] = useState('USD')
  const [churnDays, setChurnDays] = useState(20)
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<TagSyncProgress | null>(null)
  
  // Get current tab from URL or default to 'general'
  const currentTab = searchParams.get('tab') || 'general'
  
  // Handler to update tab in URL
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }
  
  // Tag Sync Rules state
  const [tagSyncRules, setTagSyncRules] = useState<TagSyncRule[]>([])
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<TagSyncRule | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [ruleFilters, setRuleFilters] = useState<FilterGroup | null>(null)

  // Fetch available tags
  const { data: availableTags = [] } = useQuery({
    queryKey: ['radius-tags'],
    queryFn: () => radiusTagApi.getAll(false),
  })

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['general-settings', currentWorkspaceId],
    queryFn: () => settingsApi.getGeneralSettings(currentWorkspaceId!),
    enabled: currentWorkspaceId !== null,
  })

  // Fetch tag sync rules from settings
  const { data: tagSyncSettings } = useQuery({
    queryKey: ['tag-sync-rules', currentWorkspaceId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workspaces/${currentWorkspaceId}/settings/tag-sync-rules`)
      return response.data
    },
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

  // Load tag sync rules
  useEffect(() => {
    if (tagSyncSettings?.rules) {
      // Transform Pascal case to camel case
      const transformedRules = tagSyncSettings.rules.map((rule: any) => ({
        id: rule.Id || rule.id,
        tagId: rule.TagId || rule.tagId,
        tagName: rule.TagName || rule.tagName,
        filterGroup: rule.FilterGroup || rule.filterGroup
      }))
      setTagSyncRules(transformedRules)
    }
  }, [tagSyncSettings])

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

  const saveTagSyncRulesMutation = useMutation({
    mutationFn: async (rules: TagSyncRule[]) => {
      // Transform camel case to Pascal case for backend
      const transformedRules = rules.map(rule => ({
        Id: rule.id,
        TagId: rule.tagId,
        TagName: rule.tagName,
        FilterGroup: rule.filterGroup
      }))
      const response = await apiClient.post(`/api/workspaces/${currentWorkspaceId}/settings/tag-sync-rules`, { rules: transformedRules })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tag-sync-rules', currentWorkspaceId] })
      toast.success('Tag sync rules saved successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to save tag sync rules')
    },
  })

  // Fetch available radius profiles for filter
  const { data: radiusProfilesData } = useQuery({
    queryKey: ['radius-profiles'],
    queryFn: async () => {
      const response = await apiClient.get('/api/radius/profiles?pageSize=1000')
      return response.data
    },
  })

  const radiusProfiles = useMemo(() => radiusProfilesData?.data || [], [radiusProfilesData?.data])

  const filterColumns: FilterColumn[] = useMemo(() => [
    { key: 'enabled', label: 'Enabled', type: 'boolean' },
    { key: 'expiration', label: 'Expiration Date', type: 'date' },
    { key: 'createdAt', label: 'Created At', type: 'date' },
    { key: 'lastOnline', label: 'Last Online', type: 'date' },
    { key: 'balance', label: 'Balance', type: 'number' },
    { 
      key: 'profileId', 
      label: 'Profile', 
      type: 'select',
      options: radiusProfiles
        .filter((profile: RadiusProfile) => profile.id !== undefined)
        .map((profile: RadiusProfile) => ({
          value: profile.id!.toString(),
          label: profile.name,
          color: profile.color,
          icon: profile.icon
        }))
    },
  ], [radiusProfiles])

  const handleSave = () => {
    updateMutation.mutate({ currency, churnDays, dateFormat })
  }

  const handleAddRule = () => {
    setEditingRule(null)
    setSelectedTagId(null)
    setRuleFilters(null)
    setShowRuleDialog(true)
  }

  const handleEditRule = (rule: TagSyncRule) => {
    setEditingRule(rule)
    setSelectedTagId(rule.tagId)
    setRuleFilters(rule.filterGroup)
    setShowRuleDialog(true)
  }

  const handleDeleteRule = (ruleId: string) => {
    const updatedRules = tagSyncRules.filter(r => r.id !== ruleId)
    setTagSyncRules(updatedRules)
    saveTagSyncRulesMutation.mutate(updatedRules)
  }

  const handleSaveRule = () => {
    if (!selectedTagId) {
      toast.error('Please select a tag')
      return
    }

    const selectedTag = availableTags.find(t => t.id === selectedTagId)
    if (!selectedTag) return

    const newRule: TagSyncRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      tagId: selectedTagId,
      tagName: selectedTag.title,
      filterGroup: ruleFilters,
    }

    let updatedRules: TagSyncRule[]
    if (editingRule) {
      updatedRules = tagSyncRules.map(r => r.id === editingRule.id ? newRule : r)
    } else {
      updatedRules = [...tagSyncRules, newRule]
    }

    // Update local state first for immediate UI feedback
    setTagSyncRules(updatedRules)
    
    // Save to backend
    saveTagSyncRulesMutation.mutate(updatedRules, {
      onSuccess: () => {
        setShowRuleDialog(false)
      },
      onError: () => {
        // Revert local state on error
        setTagSyncRules(tagSyncRules)
      }
    })
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

      // Use saved tag sync rules
      const response = await apiClient.post('/api/radius/tags/sync-with-rules')
      
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

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
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
                RADIUS Tag Sync Rules
              </CardTitle>
              <CardDescription>
                Configure automatic tag assignment rules for RADIUS users based on custom filters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Tag Sync Rules List */}
                {tagSyncRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Tags className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No tag sync rules configured yet</p>
                    <p className="text-xs mt-1">Add a rule to automatically assign tags to users</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tagSyncRules.map((rule) => {
                      const tag = availableTags.find(t => t.id === rule.tagId)
                      if (!tag) return null
                      
                      const IconComponent = getIconComponent(tag.icon || 'Tag')
                      const filterCount = rule.filterGroup?.conditions?.length || 0
                      
                      return (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <Badge
                              variant="outline"
                              className="flex items-center gap-1.5"
                              style={{
                                borderColor: tag.color || '#3b82f6',
                                color: tag.color || '#3b82f6'
                              }}
                            >
                              <IconComponent className="h-3.5 w-3.5" />
                              {tag.title}
                            </Badge>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Filter className="h-3.5 w-3.5" />
                              <span>
                                {filterCount === 0 
                                  ? 'No filters (applies to all users)' 
                                  : `${filterCount} filter${filterCount > 1 ? 's' : ''} configured`
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditRule(rule)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add Rule Button */}
                <Button
                  variant="outline"
                  onClick={handleAddRule}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag Sync Rule
                </Button>

                {/* Sync Progress */}
                {syncProgress && (
                  <div className="space-y-2 pt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{syncProgress.message}</span>
                      <span className="font-medium">{syncProgress.percentComplete}%</span>
                    </div>
                    <Progress value={syncProgress.percentComplete} className="h-2" />
                  </div>
                )}

                {/* Sync Button */}
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-muted-foreground">
                      {tagSyncRules.length === 0 
                        ? 'Add at least one rule to enable tag sync'
                        : `Ready to sync with ${tagSyncRules.length} rule${tagSyncRules.length > 1 ? 's' : ''}`
                      }
                    </div>
                  </div>
                  <Button 
                    onClick={handleSyncTags} 
                    disabled={isSyncing || tagSyncRules.length === 0}
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
                        Sync Tags Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tag Sync Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Tag Sync Rule' : 'Add Tag Sync Rule'}
            </DialogTitle>
            <DialogDescription>
              Configure which tag to assign and the filter criteria for automatic assignment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tag Selection */}
            <div className="space-y-2">
              <Label htmlFor="tag-select">Select Tag</Label>
              <Select
                value={selectedTagId?.toString() || ''}
                onValueChange={(value) => setSelectedTagId(parseInt(value))}
              >
                <SelectTrigger id="tag-select">
                  <SelectValue placeholder="Choose a tag to assign..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTags
                    .filter(tag => tag.status === 'active')
                    .map((tag) => {
                      const IconComponent = getIconComponent(tag.icon || 'Tag')
                      return (
                        <SelectItem key={tag.id} value={tag.id.toString()}>
                          <div className="flex items-center gap-2">
                            <IconComponent 
                              className="h-4 w-4" 
                              style={{ color: tag.color || '#3b82f6' }}
                            />
                            <span>{tag.title}</span>
                          </div>
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This tag will be automatically assigned to users matching the filter criteria below
              </p>
            </div>

            {/* Query Builder */}
            <div className="space-y-2">
              <Label>Filter Criteria (Optional)</Label>
              <div className="border rounded-lg p-4 bg-muted/30">
                <QueryBuilder
                  columns={filterColumns}
                  value={ruleFilters}
                  onChange={setRuleFilters}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to apply this tag to all users, or add filters to target specific users
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRule} disabled={!selectedTagId}>
              {editingRule ? 'Update Rule' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
