import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit, RefreshCw, Eye, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, ArrowUpDown, Archive, RotateCcw, Radio, Plug, History, Package, Play, Download, Upload, Users, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Progress } from '../components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { workspaceApi } from '../lib/api'
import { sasRadiusApi, type SasRadiusIntegration, type ManagerSyncProgress } from '../api/sasRadiusApi'
import { SyncProgressDialog } from '../components/SyncProgressDialog'
import { toast } from 'sonner'
import { formatApiError } from '../utils/errorHandler'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { appConfig } from '../config/app.config'
import * as signalR from '@microsoft/signalr'

export default function WorkspaceSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const queryClient = useQueryClient()
  
  // Sync history pagination state
  const [syncPage, setSyncPage] = useState(1)
  const [syncPageSize, setSyncPageSize] = useState(20)
  const [syncSortBy, setSyncSortBy] = useState('startedAt')
  const [syncSortDirection, setSyncSortDirection] = useState('desc')
  const [syncStatusFilter, setSyncStatusFilter] = useState<number | undefined>(undefined)
  
  // SAS Radius Integration state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<SasRadiusIntegration | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [integrationToRestore, setIntegrationToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [integrationToDelete, setIntegrationToDelete] = useState<number | null>(null)
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null)
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)
  const [integrationToSync, setIntegrationToSync] = useState<SasRadiusIntegration | null>(null)
  const [managerSyncProgress, setManagerSyncProgress] = useState<ManagerSyncProgress | null>(null)
  const [isManagerSyncDialogOpen, setIsManagerSyncDialogOpen] = useState(false)
  const [syncingIntegrationId, setSyncingIntegrationId] = useState<number | null>(null)
  const hubConnectionRef = useRef<signalR.HubConnection | null>(null)
  const [formData, setFormData] = useState<SasRadiusIntegration>({
    name: '',
    url: '',
    username: '',
    password: '',
    useHttps: true,
    isActive: false,
    maxPagesPerRequest: 10,
    action: '',
    description: '',
  })

  // Cleanup SignalR connection on unmount
  useEffect(() => {
    return () => {
      if (hubConnectionRef.current) {
        hubConnectionRef.current.stop()
        hubConnectionRef.current = null
      }
    }
  }, [])

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(Number(currentWorkspaceId)),
    enabled: currentWorkspaceId !== null,
  })

  const { data: integrations = [], isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ['sas-radius-integrations', currentWorkspaceId, showTrash],
    queryFn: () => showTrash
      ? sasRadiusApi.getTrash(Number(currentWorkspaceId))
      : sasRadiusApi.getAll(Number(currentWorkspaceId)),
    enabled: currentWorkspaceId !== null,
  })

  const { data: activeSyncs = [] } = useQuery({
    queryKey: ['active-syncs', currentWorkspaceId],
    queryFn: () => sasRadiusApi.getActiveSyncs(Number(currentWorkspaceId)),
    enabled: currentWorkspaceId !== null,
    refetchInterval: 3000, // Poll every 3 seconds for active syncs
  })

  const { data: recentSyncsData } = useQuery({
    queryKey: ['recent-syncs', currentWorkspaceId, syncPage, syncPageSize, syncSortBy, syncSortDirection, syncStatusFilter],
    queryFn: () => sasRadiusApi.getAllSyncs(Number(currentWorkspaceId), syncPage, syncPageSize, syncSortBy, syncSortDirection, syncStatusFilter),
    enabled: currentWorkspaceId !== null,
    refetchInterval: 5000, // Poll every 5 seconds for history
  })

  const recentSyncs = recentSyncsData?.data || []
  const syncPagination = recentSyncsData?.pagination

  const createMutation = useMutation({
    mutationFn: (data: SasRadiusIntegration) => sasRadiusApi.create(Number(currentWorkspaceId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success('Integration added successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to add integration')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ integrationId, data }: { integrationId: number; data: SasRadiusIntegration }) =>
      sasRadiusApi.update(Number(currentWorkspaceId), integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success('Integration updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update integration')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (integrationId: number) => sasRadiusApi.delete(Number(currentWorkspaceId), integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success('Integration deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete integration')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (integrationId: number) => sasRadiusApi.restore(Number(currentWorkspaceId), integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success('Integration restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore integration')
    },
  })

  const syncMutation = useMutation({
    mutationFn: (integrationId: number) => sasRadiusApi.sync(Number(currentWorkspaceId), integrationId),
    onSuccess: async (response) => {
      setActiveSyncId(response.syncId)
      setIsSyncDialogOpen(true)
      // Small delay to ensure sync is in database before dialog fetches it
      await new Promise(resolve => setTimeout(resolve, 100))
      queryClient.invalidateQueries({ queryKey: ['active-syncs', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['recent-syncs', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success(`Sync started successfully`)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.details || formatApiError(error) || 'Failed to start sync'
      toast.error(errorMessage)
    },
  })

  const syncManagersMutation = useMutation({
    mutationFn: async (integrationId: number) => {
      setSyncingIntegrationId(integrationId)
      setManagerSyncProgress({ phase: 'Starting', current: 0, total: 100, percentComplete: 0, message: 'Initializing...' })
      setIsManagerSyncDialogOpen(true)
      
      // Connect to SignalR hub for progress updates
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(`${appConfig.api.baseUrl}/hubs/sassync`)
        .withAutomaticReconnect()
        .build()
      
      hubConnectionRef.current = connection
      
      connection.on('ManagerSyncProgress', (progress: ManagerSyncProgress) => {
        setManagerSyncProgress(progress)
      })
      
      await connection.start()
      await connection.invoke('JoinManagerSyncSession', integrationId)
      
      return sasRadiusApi.syncManagers(Number(currentWorkspaceId), integrationId)
    },
    onSuccess: (response) => {
      // Disconnect SignalR
      if (hubConnectionRef.current) {
        hubConnectionRef.current.stop()
        hubConnectionRef.current = null
      }
      
      queryClient.invalidateQueries({ queryKey: ['keycloak-users'] })
      setManagerSyncProgress({ phase: 'Complete', current: 100, total: 100, percentComplete: 100, message: 'Sync completed!' })
      
      setTimeout(() => {
        setIsManagerSyncDialogOpen(false)
        setManagerSyncProgress(null)
        setSyncingIntegrationId(null)
        
        toast.success(
          `Manager sync completed: ${response.newUsersCreated} new users, ` +
          `${response.existingUsersUpdated} updated, ${response.keycloakUsersCreated} Keycloak users, ` +
          `${response.walletsCreated || 0} wallets created, ${response.zonesAssigned} zones assigned`
        )
        if (response.errors && response.errors.length > 0) {
          response.errors.forEach(error => toast.error(error))
        }
      }, 1500)
    },
    onError: (error: any) => {
      // Disconnect SignalR
      if (hubConnectionRef.current) {
        hubConnectionRef.current.stop()
        hubConnectionRef.current = null
      }
      
      setIsManagerSyncDialogOpen(false)
      setManagerSyncProgress(null)
      setSyncingIntegrationId(null)
      
      const errorMessage = error?.response?.data?.details || formatApiError(error) || 'Failed to sync managers'
      toast.error(errorMessage)
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => sasRadiusApi.exportIntegrations(Number(currentWorkspaceId)),
    onSuccess: () => {
      toast.success('Integrations exported successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to export integrations')
    },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => sasRadiusApi.importIntegrations(Number(currentWorkspaceId), file),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', currentWorkspaceId] })
      toast.success(response.message)
      if (response.errors && response.errors.length > 0) {
        response.errors.forEach(error => toast.error(error))
      }
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to import integrations')
    },
  })

  const handleExport = () => {
    exportMutation.mutate()
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      importMutation.mutate(file)
      // Reset the input so the same file can be selected again
      event.target.value = ''
    }
  }

  const handleOpenDialog = (integration?: SasRadiusIntegration) => {
    if (integration) {
      setEditingIntegration(integration)
      setFormData({
        ...integration,
        maxItemInPagePerRequest: integration.maxItemInPagePerRequest || 100,
      })
    } else {
      setEditingIntegration(null)
      setFormData({
        name: '',
        url: '',
        username: '',
        password: '',
        useHttps: true,
        isActive: false,
        maxItemInPagePerRequest: 100,
        action: '',
        description: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingIntegration(null)
    setFormData({
      name: '',
      url: '',
      username: '',
      password: '',
      useHttps: true,
      isActive: false,
      maxItemInPagePerRequest: 100,
      action: '',
      description: '',
    })
  }

  const handleSave = () => {
    if (!formData.name || !formData.url || !formData.username || !formData.password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (editingIntegration?.id) {
      updateMutation.mutate({ integrationId: editingIntegration.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (integration: SasRadiusIntegration) => {
    if (integration.id) {
      setIntegrationToDelete(integration.id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (integrationToDelete) {
      deleteMutation.mutate(integrationToDelete)
      setDeleteDialogOpen(false)
      setIntegrationToDelete(null)
    }
  }

  const handleRestore = (integrationId: number) => {
    setIntegrationToRestore(integrationId)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (integrationToRestore) {
      restoreMutation.mutate(integrationToRestore)
      setRestoreDialogOpen(false)
      setIntegrationToRestore(null)
    }
  }

  const handleSyncSort = (column: string) => {
    if (syncSortBy === column) {
      setSyncSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSyncSortBy(column)
      setSyncSortDirection('desc')
    }
    setSyncPage(1)
  }

  const handleSyncStatusFilter = (value: string) => {
    setSyncStatusFilter(value === 'all' ? undefined : Number(value))
    setSyncPage(1)
  }

  const handleSyncPageSize = (value: string) => {
    setSyncPageSize(Number(value))
    setSyncPage(1)
  }

  if (isLoading || isLoadingIntegrations) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">workspace not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Manage external system integrations for {workspace.name}</p>
      </div>

      <Tabs defaultValue="sas-radius" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sas-radius" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            SAS Radius
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sas-radius" className="space-y-6">
      <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
        <TabsContent value={showTrash ? 'trash' : 'active'} className="mt-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SAS Radius 4 Integration</CardTitle>
            <CardDescription>
              {showTrash ? 'Deleted integrations that can be restored' : 'Manage external RADIUS servers for this workspace'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Active
              </TabsTrigger>
              <TabsTrigger value="trash" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Trash
              </TabsTrigger>
            </TabsList>
            {!showTrash && (
              <>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  disabled={exportMutation.isPending || integrations.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('import-file')?.click()}
                  disabled={importMutation.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  style={{ display: 'none' }}
                />
              </>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} disabled={showTrash}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingIntegration ? 'Edit' : 'Add'} SAS Radius Integration
                </DialogTitle>
                <DialogDescription>
                  Configure the connection to your SAS Radius 4 server
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Main RADIUS Server"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    placeholder="e.g., radius.example.com or 192.168.1.100"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="e.g., admin"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between space-x-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="https"
                      checked={formData.useHttps}
                      onCheckedChange={(checked) => setFormData({ ...formData, useHttps: checked })}
                    />
                    <Label htmlFor="https" className="cursor-pointer">
                      Use HTTPS
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="active"
                      checked={formData.isActive}
                      onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    />
                    <Label htmlFor="active" className="cursor-pointer">
                      Active Server
                    </Label>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxPages">Items Per Page</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    min="1"
                    max="500"
                    placeholder="e.g., 100"
                    value={formData.maxItemInPagePerRequest}
                    onChange={(e) => setFormData({ ...formData, maxItemInPagePerRequest: parseInt(e.target.value) || 100 })}
                  />
                  <p className="text-xs text-muted-foreground">Number of items to fetch per page (1-500, default: 100)</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="action">Action</Label>
                  <Input
                    id="action"
                    placeholder="e.g., sync, authenticate, authorize"
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this integration..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingIntegration ? 'Update' : 'Add'} Integration
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Plug className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No integrations configured</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                Add your first SAS Radius 4 integration to get started
              </p>
              {!showTrash && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead className="text-center">HTTPS</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Sync Status</TableHead>
                    <TableHead className="text-center">Items/Page</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell className="font-medium">{integration.name}</TableCell>
                      <TableCell>{integration.url}</TableCell>
                      <TableCell>{integration.username}</TableCell>
                      <TableCell className="text-center">
                        {integration.useHttps ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {integration.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {integration.latestSyncStatus !== undefined ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            integration.latestSyncStatus === 8 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            integration.latestSyncStatus === 9 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            integration.latestSyncStatus === 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                            integration.latestSyncStatus < 8 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {integration.latestSyncStatus === 8 ? 'Completed' :
                             integration.latestSyncStatus === 9 ? 'Failed' :
                             integration.latestSyncStatus === 10 ? 'Cancelled' :
                             integration.latestSyncStatus < 8 ? 'Syncing' :
                             'Unknown'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            Not Started
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{integration.maxItemInPagePerRequest || 100}</span>
                      </TableCell>
                      <TableCell>{integration.action || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {integration.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {showTrash ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestore(integration.id!)}
                              disabled={restoreMutation.isPending}
                              title="Restore integration"
                            >
                              <RotateCcw className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIntegrationToSync(integration)
                                  setSyncConfirmOpen(true)
                                }}
                                disabled={syncMutation.isPending || !integration.isActive}
                                title={integration.isActive ? "Sync RADIUS Data" : "Activate integration to sync"}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (integration.id) {
                                    syncManagersMutation.mutate(integration.id)
                                  }
                                }}
                                disabled={syncManagersMutation.isPending || !integration.isActive}
                                title={integration.isActive ? "Sync Managers to Users" : "Activate integration to sync managers"}
                              >
                                <Users className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(integration)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(integration)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      {/* Active Syncs */}
      {activeSyncs.length > 0 && !showTrash && (
        <Card>
          <CardHeader>
            <CardTitle>Active Synchronizations</CardTitle>
            <CardDescription>
              Click to view real-time progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeSyncs.map((sync) => (
                <div
                  key={sync.syncId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    setActiveSyncId(sync.syncId)
                    setIsSyncDialogOpen(true)
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium">{sync.integrationName}</p>
                        <p className="text-sm text-muted-foreground">{sync.currentMessage}</p>
                      </div>
                      <Badge variant="secondary">
                        {sync.progressPercentage.toFixed(0)}%
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                    <Progress value={sync.progressPercentage} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      {!showTrash && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Synchronizations</CardTitle>
              <CardDescription>
                View past sync operations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={syncStatusFilter?.toString() || 'all'} onValueChange={handleSyncStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="8">Completed</SelectItem>
                  <SelectItem value="9">Failed</SelectItem>
                  <SelectItem value="10">Cancelled</SelectItem>
                  <SelectItem value="0">Active</SelectItem>
                </SelectContent>
              </Select>
              <Select value={syncPageSize.toString()} onValueChange={handleSyncPageSize}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="rounded-full bg-muted p-6 mb-4">
                <History className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No synchronizations found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Start a sync from your integrations to see the history here
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {recentSyncs.map((sync) => {
                  const isCompleted = sync.status === 8
                  const isFailed = sync.status === 9
                  const isCancelled = sync.status === 10
                  const isActive = sync.status < 8
                  
                  let statusIcon = <Clock className="w-4 h-4 text-gray-500" />
                  let statusBadge = { variant: 'secondary' as const, text: 'Unknown' }
                  
                  if (isCompleted) {
                    statusIcon = <CheckCircle2 className="w-4 h-4 text-green-500" />
                    statusBadge = { variant: 'default' as const, text: 'Completed' }
                  } else if (isFailed) {
                    statusIcon = <XCircle className="w-4 h-4 text-red-500" />
                    statusBadge = { variant: 'destructive' as const, text: 'Failed' }
                  } else if (isCancelled) {
                    statusIcon = <XCircle className="w-4 h-4 text-orange-500" />
                    statusBadge = { variant: 'outline' as const, text: 'Cancelled' }
                  } else if (isActive) {
                    statusIcon = <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                    statusBadge = { variant: 'secondary' as const, text: `${sync.progressPercentage.toFixed(0)}%` }
                  }
                  
                  return (
                    <div
                      key={sync.syncId}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setActiveSyncId(sync.syncId)
                        setIsSyncDialogOpen(true)
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon}
                        <div>
                          <p className="font-medium">{sync.integrationName}</p>
                          <p className="text-sm text-muted-foreground">
                            {sync.errorMessage || sync.currentMessage}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(sync.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.text}
                        </Badge>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {syncPagination && syncPagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((syncPage - 1) * syncPageSize) + 1} to {Math.min(syncPage * syncPageSize, syncPagination.totalRecords)} of {syncPagination.totalRecords} syncs
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSyncPage(p => Math.max(1, p - 1))}
                      disabled={syncPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {syncPage} of {syncPagination.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSyncPage(p => Math.min(syncPagination.totalPages, p + 1))}
                      disabled={syncPage === syncPagination.totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      <SyncProgressDialog
        open={isSyncDialogOpen}
        onOpenChange={setIsSyncDialogOpen}
        syncId={activeSyncId}
        workspaceId={Number(currentWorkspaceId)}
        onCancelSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['active-syncs', currentWorkspaceId] })
          queryClient.invalidateQueries({ queryKey: ['recent-syncs', currentWorkspaceId] })
        }}
      />

      {/* Manager Sync Progress Dialog */}
      <Dialog open={isManagerSyncDialogOpen} onOpenChange={(open) => {
        if (!open && !syncManagersMutation.isPending) {
          setIsManagerSyncDialogOpen(false)
          setManagerSyncProgress(null)
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Syncing Managers
            </DialogTitle>
            <DialogDescription>
              Syncing managers from SAS to users and assigning zones...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{managerSyncProgress?.phase || 'Initializing'}</span>
                <span className="text-muted-foreground">{managerSyncProgress?.percentComplete || 0}%</span>
              </div>
              <Progress value={managerSyncProgress?.percentComplete || 0} className="h-2" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {managerSyncProgress?.phase !== 'Complete' && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {managerSyncProgress?.phase === 'Complete' && (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              <span>{managerSyncProgress?.message || 'Preparing...'}</span>
            </div>
            {managerSyncProgress?.total && managerSyncProgress.total > 0 && managerSyncProgress.phase !== 'Complete' && (
              <div className="text-xs text-muted-foreground">
                {managerSyncProgress.current} of {managerSyncProgress.total}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync Confirmation Dialog */}
      <AlertDialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Synchronization?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start synchronizing profiles and users from "{integrationToSync?.name}". 
              The process may take several minutes depending on the amount of data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (integrationToSync?.id) {
                  syncMutation.mutate(integrationToSync.id)
                }
                setSyncConfirmOpen(false)
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the SAS RADIUS integration to trash. You can restore it later from the trash view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Integration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the SAS RADIUS integration and make it available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  )
}

