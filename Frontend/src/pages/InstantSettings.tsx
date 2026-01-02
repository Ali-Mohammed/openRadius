import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
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
import { instantApi } from '../lib/api'
import { sasRadiusApi, type SasRadiusIntegration } from '../api/sasRadiusApi'
import { toast } from 'sonner'
import { formatApiError } from '../utils/errorHandler'

export default function InstantSettings() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  
  // SAS Radius Integration state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIntegration, setEditingIntegration] = useState<SasRadiusIntegration | null>(null)
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

  const { data: instant, isLoading } = useQuery({
    queryKey: ['instant', id],
    queryFn: () => instantApi.getById(Number(id)),
    enabled: !!id,
  })

  const { data: integrations = [], isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ['sas-radius-integrations', id],
    queryFn: () => sasRadiusApi.getAll(Number(id)),
    enabled: !!id,
  })

  const createMutation = useMutation({
    mutationFn: (data: SasRadiusIntegration) => sasRadiusApi.create(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', id] })
      toast.success('Integration added successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to add integration')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ integrationId, data }: { integrationId: number; data: SasRadiusIntegration }) =>
      sasRadiusApi.update(Number(id), integrationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', id] })
      toast.success('Integration updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update integration')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (integrationId: number) => sasRadiusApi.delete(Number(id), integrationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integrations', id] })
      toast.success('Integration deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete integration')
    },
  })

  const handleOpenDialog = (integration?: SasRadiusIntegration) => {
    if (integration) {
      setEditingIntegration(integration)
      setFormData(integration)
    } else {
      setEditingIntegration(null)
      setFormData({
        name: '',
        url: '',
        username: '',
        password: '',
        useHttps: true,
        isActive: false,
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
      maxPagesPerRequest: 10,
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
    if (integration.id && confirm('Are you sure you want to delete this integration?')) {
      deleteMutation.mutate(integration.id)
    }
  }

  if (isLoading || isLoadingIntegrations) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!instant) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">Instant not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{instant.name} Settings</h1>
        <p className="text-muted-foreground">Configure SAS Radius 4 Integration</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SAS Radius 4 Integration</CardTitle>
            <CardDescription>
              Manage external RADIUS servers for this instant
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
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
                  <Label htmlFor="maxPages">Max Pages Per Request</Label>
                  <Input
                    id="maxPages"
                    type="number"
                    min="1"
                    max="100"
                    placeholder="e.g., 10"
                    value={formData.maxPagesPerRequest}
                    onChange={(e) => setFormData({ ...formData, maxPagesPerRequest: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground">Maximum number of pages to fetch per sync request (1-100)</p>
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
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No integrations configured</p>
              <p className="text-sm text-muted-foreground">
                Add your first SAS Radius 4 integration to get started
              </p>
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
                      <TableCell>{integration.action || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {integration.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
    </div>
  )
}
