import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Plus, 
  Settings, 
  Trash2, 
  Copy, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { integrationWebhookApi, type IntegrationWebhook, type CreateWebhookRequest } from '@/api/integrationWebhookApi'

export default function Integrations() {
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<IntegrationWebhook | null>(null)
  const [showToken, setShowToken] = useState<Record<number, boolean>>({})

  const [formData, setFormData] = useState<CreateWebhookRequest>({
    integrationName: '',
    integrationType: 'sas-radius',
    callbackEnabled: true,
    requireAuthentication: true,
    allowedIpAddresses: '',
    description: '',
  })

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['integration-webhooks', currentWorkspaceId],
    queryFn: () => integrationWebhookApi.getAll(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateWebhookRequest) =>
      integrationWebhookApi.create(currentWorkspaceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Integration webhook created successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create webhook')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      integrationWebhookApi.update(currentWorkspaceId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Webhook updated successfully')
      setIsSettingsOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update webhook')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => integrationWebhookApi.delete(currentWorkspaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Webhook deleted successfully')
      setIsDeleteDialogOpen(false)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete webhook')
    },
  })

  const regenerateTokenMutation = useMutation({
    mutationFn: (id: number) => integrationWebhookApi.regenerateToken(currentWorkspaceId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-webhooks'] })
      toast.success('Token regenerated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to regenerate token')
    },
  })

  const handleCreate = () => {
    createMutation.mutate(formData)
  }

  const handleToggleCallback = (webhook: IntegrationWebhook) => {
    updateMutation.mutate({
      id: webhook.id!,
      data: {
        ...webhook,
        callbackEnabled: !webhook.callbackEnabled,
      },
    })
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('Webhook URL copied to clipboard')
  }

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success('Token copied to clipboard')
  }

  const handleOpenSettings = (webhook: IntegrationWebhook) => {
    setSelectedWebhook(webhook)
    setIsSettingsOpen(true)
  }

  const handleSaveSettings = () => {
    if (!selectedWebhook) return

    updateMutation.mutate({
      id: selectedWebhook.id!,
      data: {
        integrationName: selectedWebhook.integrationName,
        integrationType: selectedWebhook.integrationType,
        callbackEnabled: selectedWebhook.callbackEnabled,
        requireAuthentication: selectedWebhook.requireAuthentication,
        allowedIpAddresses: selectedWebhook.allowedIpAddresses,
        description: selectedWebhook.description,
        isActive: selectedWebhook.isActive,
      },
    })
  }

  const handleDeleteClick = (webhook: IntegrationWebhook) => {
    setSelectedWebhook(webhook)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (selectedWebhook?.id) {
      deleteMutation.mutate(selectedWebhook.id)
    }
  }

  const handleRegenerateToken = (webhook: IntegrationWebhook) => {
    regenerateTokenMutation.mutate(webhook.id!)
  }

  const toggleShowToken = (id: number) => {
    setShowToken(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const resetForm = () => {
    setFormData({
      integrationName: '',
      integrationType: 'sas-radius',
      callbackEnabled: true,
      requireAuthentication: true,
      allowedIpAddresses: '',
      description: '',
    })
  }

  if (isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Manage webhook callbacks for external system integrations
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <div className="grid gap-4">
        {webhooks?.map((webhook) => (
          <Card key={webhook.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    {webhook.integrationName}
                    {webhook.isActive ? (
                      <Badge variant="default" className="ml-2">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{webhook.description || 'No description'}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenSettings(webhook)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(webhook)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Callback Enable Toggle */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Enable Callback Function</div>
                  <div className="text-xs text-muted-foreground">
                    Allow external systems to send data via webhook
                  </div>
                </div>
                <Switch
                  checked={webhook.callbackEnabled}
                  onCheckedChange={() => handleToggleCallback(webhook)}
                />
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhook.webhookUrl}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyUrl(webhook.webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This URL can be called by external systems to update RADIUS user information
                </p>
              </div>

              {/* Token */}
              <div className="space-y-2">
                <Label>Security Token</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      readOnly
                      type={showToken[webhook.id!] ? 'text' : 'password'}
                      value={webhook.webhookToken}
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full"
                      onClick={() => toggleShowToken(webhook.id!)}
                    >
                      {showToken[webhook.id!] ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopyToken(webhook.webhookToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRegenerateToken(webhook)}
                    title="Regenerate token"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Requests:</span>
                  <span className="font-medium">{webhook.requestCount}</span>
                </div>
                {webhook.lastUsedAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Last used:</span>
                    <span className="font-medium">
                      {new Date(webhook.lastUsedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {webhooks?.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No integrations yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first integration to start receiving webhook callbacks
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Integration
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Integration Webhook</DialogTitle>
            <DialogDescription>
              Create a new webhook endpoint for external system integration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Integration Name</Label>
              <Input
                id="name"
                placeholder="e.g., SAS RADIUS Sync"
                value={formData.integrationName}
                onChange={(e) => setFormData({ ...formData, integrationName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Integration Type</Label>
              <Select
                value={formData.integrationType}
                onValueChange={(value) => setFormData({ ...formData, integrationType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sas-radius">SAS RADIUS</SelectItem>
                  <SelectItem value="custom">Custom Integration</SelectItem>
                  <SelectItem value="api">API Integration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Enable Callback</div>
                <div className="text-xs text-muted-foreground">
                  Enable webhook to receive callbacks
                </div>
              </div>
              <Switch
                checked={formData.callbackEnabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, callbackEnabled: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Require Authentication</div>
                <div className="text-xs text-muted-foreground">
                  Validate webhook token on requests
                </div>
              </div>
              <Switch
                checked={formData.requireAuthentication}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, requireAuthentication: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this integration..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.integrationName}>
              Create Integration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Integration Settings</DialogTitle>
            <DialogDescription>
              Configure webhook settings and security options
            </DialogDescription>
          </DialogHeader>
          {selectedWebhook && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Integration Name</Label>
                <Input
                  value={selectedWebhook.integrationName}
                  onChange={(e) =>
                    setSelectedWebhook({ ...selectedWebhook, integrationName: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Enable or disable this integration
                  </div>
                </div>
                <Switch
                  checked={selectedWebhook.isActive}
                  onCheckedChange={(checked) =>
                    setSelectedWebhook({ ...selectedWebhook, isActive: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Callback Enabled</div>
                  <div className="text-xs text-muted-foreground">
                    Allow webhook to receive data
                  </div>
                </div>
                <Switch
                  checked={selectedWebhook.callbackEnabled}
                  onCheckedChange={(checked) =>
                    setSelectedWebhook({ ...selectedWebhook, callbackEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={selectedWebhook.description || ''}
                  onChange={(e) =>
                    setSelectedWebhook({ ...selectedWebhook, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Integration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedWebhook?.integrationName}"? This will
              disable the webhook URL and prevent further callbacks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
