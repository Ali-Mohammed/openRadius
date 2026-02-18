import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { appConfig } from '@/config/app.config'
import { toast } from 'sonner'
import { Copy, Plus, Trash2, Eye, EyeOff, Key, Clock, Shield, RefreshCw, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { apiKeysApi, type ApiKeyDto, type ApiKeyCreatedDto, type ApiKeyScopeInfo } from '@/api/apiKeysApi'

export default function ApiKeysTab() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId, currentWorkspace } = useWorkspace()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createdKey, setCreatedKey] = useState<ApiKeyCreatedDto | null>(null)
  const [deleteUuid, setDeleteUuid] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  // Form state
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([])
  const [newKeyExpiration, setNewKeyExpiration] = useState('')

  // ── Queries ─────────────────────────────────────────────────────
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['api-keys', currentWorkspaceId],
    queryFn: () => apiKeysApi.list(1, 100),
    enabled: currentWorkspaceId !== null,
  })

  const { data: scopes = [] } = useQuery({
    queryKey: ['api-key-scopes', currentWorkspaceId],
    queryFn: () => apiKeysApi.getScopes(),
    enabled: currentWorkspaceId !== null,
  })

  // ── Mutations ───────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: (data) => {
      setCreatedKey(data)
      setShowCreateDialog(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspaceId] })
      toast.success('API key created successfully')
    },
    onError: (error) => toast.error(formatApiError(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (uuid: string) => apiKeysApi.delete(uuid),
    onSuccess: () => {
      setDeleteUuid(null)
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspaceId] })
      toast.success('API key deleted')
    },
    onError: (error) => toast.error(formatApiError(error)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ uuid, isActive }: { uuid: string; isActive: boolean }) =>
      apiKeysApi.update(uuid, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys', currentWorkspaceId] })
      toast.success('API key updated')
    },
    onError: (error) => toast.error(formatApiError(error)),
  })

  // ── Helpers ─────────────────────────────────────────────────────
  const resetForm = () => {
    setNewKeyName('')
    setNewKeyScopes([])
    setNewKeyExpiration('')
  }

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.error('Name is required')
      return
    }
    createMutation.mutate({
      name: newKeyName.trim(),
      scopes: newKeyScopes.length > 0 ? newKeyScopes : undefined,
      expiresAt: newKeyExpiration || null,
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const toggleScope = (scopeKey: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scopeKey) ? prev.filter((s) => s !== scopeKey) : [...prev, scopeKey]
    )
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const isExpired = (key: ApiKeyDto) => {
    if (!key.expiresAt) return false
    return new Date(key.expiresAt) < new Date()
  }

  const apiKeys = apiKeysData?.data ?? []

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
                {currentWorkspace && (
                  <Badge variant="outline" className="text-[10px] font-normal ml-1">
                    {currentWorkspace.title || currentWorkspace.name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Manage API keys for this workspace. Each key grants external programmatic access to this workspace's data only.
                API keys authenticate requests to the <code className="bg-muted px-1 rounded text-xs">/api/v1/</code> endpoints.
              </CardDescription>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No API keys yet</p>
              <p className="text-sm mt-1">Create an API key to access your workspace data programmatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.uuid}
                  className={`border rounded-lg p-4 ${
                    !key.isActive || isExpired(key) ? 'opacity-60 bg-muted/30' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{key.name}</span>
                        {key.isActive && !isExpired(key) ? (
                          <Badge variant="default" className="text-[10px]">Active</Badge>
                        ) : isExpired(key) ? (
                          <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">{key.keyPrefix}...</code>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Created {formatDate(key.createdAt)}
                        </span>
                        {key.lastUsedAt && (
                          <span>Last used {formatDate(key.lastUsedAt)}</span>
                        )}
                        {key.expiresAt && (
                          <span className={isExpired(key) ? 'text-destructive' : ''}>
                            Expires {formatDate(key.expiresAt)}
                          </span>
                        )}
                      </div>
                      {key.scopes.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          {key.scopes.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={key.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ uuid: key.uuid, isActive: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteUuid(key.uuid)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">List RADIUS Users</Label>
            <div className="relative">
              <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "${appConfig.api.baseUrl}/api/v1/radius/users?page=1&limit=25"`}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7"
                onClick={() => copyToClipboard(`curl -H "X-API-Key: YOUR_API_KEY" "${appConfig.api.baseUrl}/api/v1/radius/users?page=1&limit=25"`)}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Filter by enabled & search</Label>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "${appConfig.api.baseUrl}/api/v1/radius/users?enabled=true&search=john&limit=10"`}
            </pre>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Get single user by UUID</Label>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -H "X-API-Key: YOUR_API_KEY" \\
  "${appConfig.api.baseUrl}/api/v1/radius/users/{uuid}"`}
            </pre>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <p><strong>Available filters:</strong> search, enabled, profileName, groupName, zoneName, onlineStatus, createdAfter, createdBefore</p>
            <p><strong>Sorting:</strong> sortBy (username, createdAt, balance, expiration, lastOnline) &amp; sortDirection (asc, desc)</p>
            <p><strong>Pagination:</strong> page (default: 1) &amp; limit (default: 25, max: 100)</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Create Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for external access. The key will only be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. CRM Integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Leave empty for unrestricted access. Select specific scopes to limit.
              </p>
              <div className="space-y-2">
                {scopes.map((scope: ApiKeyScopeInfo) => (
                  <label
                    key={scope.key}
                    className="flex items-start gap-3 p-2 border rounded-md cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope.key)}
                      onChange={() => toggleScope(scope.key)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium font-mono">{scope.key}</div>
                      <div className="text-xs text-muted-foreground">{scope.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="key-expiration">Expiration (optional)</Label>
              <Input
                id="key-expiration"
                type="datetime-local"
                value={newKeyExpiration}
                onChange={(e) => setNewKeyExpiration(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank for a key that never expires.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Created Key Display Dialog ─────────────────────────────── */}
      <Dialog open={!!createdKey} onOpenChange={() => setCreatedKey(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="font-medium">{createdKey.name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API Key</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 bg-muted p-2.5 rounded-md font-mono text-xs break-all select-all">
                    {showKey ? createdKey.key : '•'.repeat(40)}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdKey.key)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                <strong>Important:</strong> This is the only time the full API key will be displayed.
                Store it securely — it cannot be retrieved later.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setCreatedKey(null); setShowKey(false) }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!deleteUuid} onOpenChange={() => setDeleteUuid(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently deactivate this API key. Any integrations using it will stop working immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUuid && deleteMutation.mutate(deleteUuid)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
