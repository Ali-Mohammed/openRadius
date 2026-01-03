import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2, Shield, TestTube, Save, AlertCircle, Plus, Edit, Trash2, Star, Eye, EyeOff, Archive, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiClient } from '@/lib/api'
import { appConfig } from '@/config/app.config'

interface OidcProvider {
  id?: number
  providerName: string
  displayName: string
  description?: string
  logoUrl?: string
  displayOrder: number
  authority: string
  clientId: string
  clientSecret?: string
  redirectUri: string
  postLogoutRedirectUri?: string
  responseType: string
  scope: string
  metadataAddress?: string
  requireHttpsMetadata: boolean
  issuer?: string
  audience?: string
  validateAudience: boolean
  isActive: boolean
  isDefault: boolean
}

const PROVIDER_PRESETS = {
  keycloak: {
    displayName: 'Keycloak',
    description: 'Enterprise Identity and Access Management',
    logoUrl: '',
    responseType: 'code',
    scope: 'openid profile email',
    requireHttpsMetadata: false,
    validateAudience: false,
  },
  azuread: {
    displayName: 'Azure AD',
    description: 'Microsoft Azure Active Directory',
    logoUrl: '',
    responseType: 'code',
    scope: 'openid profile email',
    requireHttpsMetadata: true,
    validateAudience: true,
  },
  google: {
    displayName: 'Google',
    description: 'Sign in with Google',
    logoUrl: '',
    responseType: 'code',
    scope: 'openid profile email',
    requireHttpsMetadata: true,
    validateAudience: true,
  },
  custom: {
    displayName: '',
    description: '',
    logoUrl: '',
    responseType: 'code',
    scope: 'openid profile email',
    requireHttpsMetadata: true,
    validateAudience: false,
  }
}

export default function OidcSettingsPage() {
  const [providers, setProviders] = useState<OidcProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<OidcProvider | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<{ id: number; isDefault: boolean } | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [providerToRestore, setProviderToRestore] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string>('custom')
  const [showTrash, setShowTrash] = useState(false)
  
  const [formData, setFormData] = useState<OidcProvider>({
    providerName: '',
    displayName: '',
    description: '',
    logoUrl: '',
    displayOrder: 0,
    authority: '',
    clientId: '',
    clientSecret: '',
    redirectUri: appConfig.frontend.baseUrl,
    postLogoutRedirectUri: appConfig.frontend.baseUrl,
    responseType: 'code',
    scope: 'openid profile email',
    metadataAddress: '',
    requireHttpsMetadata: false,
    issuer: '',
    audience: '',
    validateAudience: false,
    isActive: true,
    isDefault: false,
  })

  useEffect(() => {
    if (showTrash) {
      loadDeletedProviders()
    } else {
      loadProviders()
    }
  }, [showTrash])

  const loadProviders = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get('/api/oidcsettings')
      setProviders(data)
    } catch (error) {
      console.error('Failed to load OIDC providers:', error)
      toast.error('Failed to load OIDC providers')
    } finally {
      setLoading(false)
    }
  }

  const loadDeletedProviders = async () => {
    try {
      setLoading(true)
      const { data } = await apiClient.get('/api/oidcsettings/trash')
      setProviders(data)
    } catch (error) {
      console.error('Failed to load deleted OIDC providers:', error)
      toast.error('Failed to load deleted OIDC providers')
    } finally {
      setLoading(false)
    }
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    const presetData = PROVIDER_PRESETS[preset as keyof typeof PROVIDER_PRESETS]
    
    setFormData({
      ...formData,
      providerName: preset === 'custom' ? '' : preset,
      displayName: presetData.displayName,
      description: presetData.description,
      logoUrl: presetData.logoUrl,
      responseType: presetData.responseType,
      scope: presetData.scope,
      requireHttpsMetadata: presetData.requireHttpsMetadata,
      validateAudience: presetData.validateAudience,
    })
  }

  const openCreateDialog = () => {
    setEditingProvider(null)
    setSelectedPreset('custom')
    setFormData({
      providerName: '',
      displayName: '',
      description: '',
      logoUrl: '',
      displayOrder: providers.length,
      authority: '',
      clientId: '',
      clientSecret: '',
      redirectUri: appConfig.frontend.baseUrl,
      postLogoutRedirectUri: appConfig.frontend.baseUrl,
      responseType: 'code',
      scope: 'openid profile email',
      metadataAddress: '',
      requireHttpsMetadata: false,
      issuer: '',
      audience: '',
      validateAudience: false,
      isActive: true,
      isDefault: false,
    })
    setDialogOpen(true)
  }

  const openEditDialog = (provider: OidcProvider) => {
    setEditingProvider(provider)
    setSelectedPreset('custom')
    setFormData({ ...provider })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      if (editingProvider) {
        await apiClient.put(`/api/oidcsettings/${editingProvider.id}`, formData)
      } else {
        await apiClient.post('/api/oidcsettings', formData)
      }

      toast.success(`OIDC provider ${editingProvider ? 'updated' : 'created'} successfully`)
      setDialogOpen(false)
      loadProviders()
    } catch (error) {
      console.error('Failed to save OIDC provider:', error)
      toast.error('Failed to save OIDC provider')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: number, isDefault: boolean) => {
    if (isDefault) {
      toast.error('Cannot delete the default OIDC provider')
      return
    }
    setProviderToDelete({ id, isDefault })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!providerToDelete) return

    try {
      await apiClient.delete(`/api/oidcsettings/${providerToDelete.id}`)
      toast.success('Provider deleted successfully')
      loadProviders()
    } catch (error) {
      console.error('Failed to delete provider:', error)
      toast.error('Failed to delete provider')
    } finally {
      setDeleteDialogOpen(false)
      setProviderToDelete(null)
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await apiClient.put(`/api/oidcsettings/${id}/set-default`)
      toast.success('Default provider updated')
      loadProviders()
    } catch (error) {
      console.error('Failed to set default provider:', error)
      toast.error('Failed to set default provider')
    }
  }

  const handleToggleActive = async (id: number) => {
    try {
      await apiClient.put(`/api/oidcsettings/${id}/toggle-active`)
      toast.success('Provider status updated')
      loadProviders()
    } catch (error) {
      console.error('Failed to toggle provider:', error)
      toast.error('Failed to toggle provider')
    }
  }

  const handleTest = async () => {
    try {
      setTesting(true)
      const { data } = await apiClient.post('/api/oidcsettings/test', formData)
      
      if (data.success) {
        toast.success('Successfully connected to OIDC provider!')
      } else {
        toast.error(`Connection failed: ${data.message}`)
      }
    } catch (error) {
      console.error('Failed to test OIDC connection:', error)
      toast.error('Failed to test OIDC connection')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6" />
          <h1 className="text-3xl font-bold">OIDC Providers</h1>
        </div>
        <Button onClick={openCreateDialog} variant="default">
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Manage multiple OIDC authentication providers. Users will see all active providers on the login page.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Configured Providers</CardTitle>
          <CardDescription>
            Manage Keycloak, Azure AD, Google, and other OIDC providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No OIDC providers configured</p>
              <p className="text-sm">Click "Add Provider" to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {provider.displayName}
                              {provider.isDefault && (
                                <Badge variant="default" className="text-xs">
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            {provider.description && (
                              <div className="text-xs text-muted-foreground">
                                {provider.description}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              Provider: {provider.providerName}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{provider.authority}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-mono">{provider.clientId}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(provider.id!)}
                        >
                          {provider.isActive ? (
                            <Badge variant="default" className="gap-1">
                              <Eye className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              Inactive
                            </Badge>
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!provider.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(provider.id!)}
                              title="Set as default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(provider)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(provider.id!, provider.isDefault)}
                            disabled={provider.isDefault}
                            title={provider.isDefault ? 'Cannot delete default provider' : 'Delete provider'}
                          >
                            <Trash2 className={`h-4 w-4 ${provider.isDefault ? 'text-muted-foreground' : 'text-destructive'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProvider ? 'Edit' : 'Add'} OIDC Provider
            </DialogTitle>
            <DialogDescription>
              Configure an OpenID Connect authentication provider
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!editingProvider && (
              <div className="space-y-2">
                <Label>Provider Template</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keycloak">Keycloak</SelectItem>
                    <SelectItem value="azuread">Azure AD</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                    <SelectItem value="custom">Custom Provider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="providerName">Provider Name *</Label>
                <Input
                  id="providerName"
                  placeholder="keycloak, azuread, google"
                  value={formData.providerName}
                  onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                  disabled={!!editingProvider}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name *</Label>
                <Input
                  id="displayName"
                  placeholder="Login with Keycloak"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enterprise Identity and Access Management"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="authority">Authority URL *</Label>
                <Input
                  id="authority"
                  placeholder="http://localhost:8080/realms/openradius"
                  value={formData.authority}
                  onChange={(e) => setFormData({ ...formData, authority: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID *</Label>
                <Input
                  id="clientId"
                  placeholder="openradius-web"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret (Optional)</Label>
              <Input
                id="clientSecret"
                type="password"
                placeholder="••••••••••••"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="redirectUri">Redirect URI</Label>
                <Input
                  id="redirectUri"
                  value={formData.redirectUri}
                  onChange={(e) => setFormData({ ...formData, redirectUri: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">Scope</Label>
                <Input
                  id="scope"
                  value={formData.scope}
                  onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayOrder">Display Order</Label>
              <Input
                id="displayOrder"
                type="number"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active (visible on login page)</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
              <Label htmlFor="isDefault">Set as default provider</Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={handleTest}
              variant="default"
              disabled={testing || !formData.authority}
            >
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            <Button
              onClick={handleSave}
              variant="default"
              disabled={saving || !formData.providerName || !formData.displayName || !formData.authority || !formData.clientId}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {editingProvider ? 'Update' : 'Create'} Provider
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the OIDC provider.
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
    </div>
  )
}
