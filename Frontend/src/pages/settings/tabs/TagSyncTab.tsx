import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tags, Loader2, Filter, Plus, Trash2, Edit2 } from 'lucide-react'
import { QueryBuilder, type FilterGroup, type FilterColumn } from '@/components/QueryBuilder'
import { radiusTagApi } from '@/api/radiusTagApi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getIconComponent } from '@/utils/iconColorHelper'
import { apiClient } from '@/lib/api'
import * as signalR from '@microsoft/signalr'
import { appConfig } from '@/config/app.config'

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

interface TagSyncTabProps {
  currentWorkspaceId: number | null
  filterColumns: FilterColumn[]
}

export default function TagSyncTab({ currentWorkspaceId, filterColumns }: TagSyncTabProps) {
  const queryClient = useQueryClient()
  const [tagSyncRules, setTagSyncRules] = useState<TagSyncRule[]>([])
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<TagSyncRule | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null)
  const [ruleFilters, setRuleFilters] = useState<FilterGroup | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<TagSyncProgress | null>(null)

  const { data: availableTags = [] } = useQuery({
    queryKey: ['radius-tags'],
    queryFn: () => radiusTagApi.getAll(false),
  })

  const { data: tagSyncSettings } = useQuery({
    queryKey: ['tag-sync-rules', currentWorkspaceId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workspaces/${currentWorkspaceId}/settings/tag-sync-rules`)
      return response.data
    },
    enabled: currentWorkspaceId !== null,
  })

  useEffect(() => {
    if (tagSyncSettings?.rules) {
      const transformedRules = tagSyncSettings.rules.map((rule: any) => ({
        id: rule.Id || rule.id,
        tagId: rule.TagId || rule.tagId,
        tagName: rule.TagName || rule.tagName,
        filterGroup: rule.FilterGroup || rule.filterGroup
      }))
      setTagSyncRules(transformedRules)
    }
  }, [tagSyncSettings])

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

  const handleSaveRule = async () => {
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
      filterGroup: ruleFilters
    }

    try {
      const updatedRules = editingRule
        ? tagSyncRules.map(r => r.id === editingRule.id ? newRule : r)
        : [...tagSyncRules, newRule]

      await apiClient.post(`/api/workspaces/${currentWorkspaceId}/settings/tag-sync-rules`, {
        rules: updatedRules
      })

      setTagSyncRules(updatedRules)
      setShowRuleDialog(false)
      toast.success(editingRule ? 'Rule updated successfully' : 'Rule added successfully')
      queryClient.invalidateQueries({ queryKey: ['tag-sync-rules', currentWorkspaceId] })
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save rule')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const updatedRules = tagSyncRules.filter(r => r.id !== ruleId)
      await apiClient.post(`/api/workspaces/${currentWorkspaceId}/settings/tag-sync-rules`, {
        rules: updatedRules
      })
      setTagSyncRules(updatedRules)
      toast.success('Rule deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['tag-sync-rules', currentWorkspaceId] })
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete rule')
    }
  }

  const handleSyncTags = async () => {
    if (!currentWorkspaceId) return

    setIsSyncing(true)
    setSyncProgress(null)

    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${appConfig.api.baseUrl}/hubs/tag-sync`, {
        accessTokenFactory: () => localStorage.getItem('auth_token') || '',
      })
      .withAutomaticReconnect()
      .build()

    hubConnection.on('SyncProgress', (progress: TagSyncProgress) => {
      setSyncProgress(progress)
    })

    try {
      await hubConnection.start()
      const response = await apiClient.post(`/api/workspaces/${currentWorkspaceId}/tag-sync/execute`)
      toast.success(response.data.message || 'Tag sync completed successfully')
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to sync tags')
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
      await hubConnection.stop()
    }
  }

  return (
    <>
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

            <Button variant="outline" onClick={handleAddRule} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Tag Sync Rule
            </Button>

            {syncProgress && (
              <div className="space-y-2 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span>{syncProgress.message}</span>
                  <span className="font-medium">{syncProgress.percentComplete}%</span>
                </div>
                <Progress value={syncProgress.percentComplete} className="h-2" />
              </div>
            )}

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
    </>
  )
}
