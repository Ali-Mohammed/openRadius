import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userManagementApi, type Permission } from '@/api/userManagementApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Trash2, Lock, Shield, RotateCcw, Pencil, Search, ChevronDown, ChevronRight } from 'lucide-react'

// Category display names for enterprise UI
const CATEGORY_LABELS: Record<string, string> = {
  Integration: 'Integration',
  RADIUS: 'RADIUS Management',
  Workspace: 'Workspace',
  Settings: 'App Settings',
  UserManagement: 'User Management',
  General: 'General',
  Billing: 'Billing',
  Network: 'Network',
  Connectors: 'Connectors',
  Microservices: 'Microservices',
}

export default function PermissionsPage() {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Form state for create/edit
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formCategory, setFormCategory] = useState('General')

  // Fetch permissions
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions', showDeleted],
    queryFn: () => userManagementApi.getPermissions(showDeleted),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Fetch categories dynamically from backend
  const { data: backendCategories = [] } = useQuery({
    queryKey: ['permission-categories'],
    queryFn: () => userManagementApi.getPermissionCategories(),
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Create
  const createMutation = useMutation({
    mutationFn: userManagementApi.createPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      queryClient.invalidateQueries({ queryKey: ['permission-categories'] })
      closeDialog()
      toast.success('Permission created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create permission')
    },
  })

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; category?: string } }) =>
      userManagementApi.updatePermission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      queryClient.invalidateQueries({ queryKey: ['permission-categories'] })
      closeDialog()
      toast.success('Permission updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update permission')
    },
  })

  // Delete
  const deleteMutation = useMutation({
    mutationFn: userManagementApi.deletePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setDeletingPermission(null)
      toast.success('Permission deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete permission')
    },
  })

  // Restore
  const restoreMutation = useMutation({
    mutationFn: userManagementApi.restorePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      toast.success('Permission restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to restore permission')
    },
  })

  // Build the categories list dynamically from backend + permissions data
  const allCategories = useMemo(() => {
    const cats = new Set<string>(backendCategories)
    permissions.forEach((p) => {
      if (p.category) cats.add(p.category)
    })
    const knownOrder = ['General', 'UserManagement', 'RADIUS', 'Billing', 'Network', 'Connectors', 'Microservices', 'Integration', 'Workspace', 'Settings']
    return Array.from(cats).sort((a, b) => {
      const ai = knownOrder.indexOf(a)
      const bi = knownOrder.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }, [backendCategories, permissions])

  // Group and filter permissions
  const groupedPermissions = useMemo(() => {
    const filtered = searchQuery
      ? permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : permissions

    return filtered.reduce((acc, permission) => {
      const category = permission.category || 'General'
      if (!acc[category]) acc[category] = []
      acc[category].push(permission)
      return acc
    }, {} as Record<string, Permission[]>)
  }, [permissions, searchQuery])

  const totalCount = permissions.length
  const filteredCount = Object.values(groupedPermissions).reduce((sum, arr) => sum + arr.length, 0)

  function closeDialog() {
    setShowCreateDialog(false)
    setEditingPermission(null)
    setFormName('')
    setFormDesc('')
    setFormCategory('General')
  }

  function openEditDialog(permission: Permission) {
    setEditingPermission(permission)
    setFormName(permission.name)
    setFormDesc(permission.description || '')
    setFormCategory(permission.category || 'General')
  }

  function openCreateDialog() {
    setFormName('')
    setFormDesc('')
    setFormCategory('General')
    setShowCreateDialog(true)
  }

  function handleSave() {
    if (editingPermission) {
      updateMutation.mutate({
        id: editingPermission.id,
        data: { name: formName, description: formDesc, category: formCategory },
      })
    } else {
      createMutation.mutate({ name: formName, description: formDesc, category: formCategory })
    }
  }

  function toggleCategory(category: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground">
            Define granular permissions for your application
            {totalCount > 0 && (
              <span className="ml-2">
                <Badge variant="secondary" className="text-xs">{totalCount} total</Badge>
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? 'secondary' : 'outline'}
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {showDeleted ? 'Show Active' : 'Show Deleted'}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Permission
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search permissions by name, description, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searchQuery && filteredCount !== totalCount && (
          <p className="text-xs text-muted-foreground mt-1">
            Showing {filteredCount} of {totalCount} permissions
          </p>
        )}
      </div>

      {/* Permission Categories */}
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {allCategories.map((category) => {
            const categoryPermissions = groupedPermissions[category] || []
            if (categoryPermissions.length === 0) return null

            const isCollapsed = collapsedCategories.has(category)
            const displayName = CATEGORY_LABELS[category] || category

            return (
              <Card key={category}>
                <CardHeader
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Shield className="h-5 w-5" />
                      <CardTitle className="text-lg">{displayName}</CardTitle>
                    </div>
                    <Badge variant="outline">
                      {categoryPermissions.length} permission{categoryPermissions.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {!isCollapsed && (
                    <CardDescription className="ml-10">
                      Manage {displayName.toLowerCase()} access controls
                    </CardDescription>
                  )}
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <div className="grid gap-2">
                      {categoryPermissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium font-mono text-sm">{permission.name}</span>
                            </div>
                            {permission.description && (
                              <p className="text-sm text-muted-foreground mt-1 ml-6">
                                {permission.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 ml-2">
                            {showDeleted ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => restoreMutation.mutate(permission.id)}
                                disabled={restoreMutation.isPending}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(permission)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeletingPermission(permission)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}

          {Object.keys(groupedPermissions).length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'No permissions match your search.'
                    : 'No permissions found. Click "Add Permission" to create one.'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingPermission}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? 'Edit Permission' : 'Create New Permission'}
            </DialogTitle>
            <DialogDescription>
              {editingPermission
                ? 'Update permission details. Changes may affect roles using this permission.'
                : 'Add a new permission that can be assigned to roles.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="permission-name">Permission Name *</Label>
              <Input
                id="permission-name"
                placeholder="e.g., billing.invoices.view"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use dot notation: category.resource.action (e.g., radius.users.view)
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-category">Category *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger id="permission-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category] || category}
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                  {Object.keys(CATEGORY_LABELS)
                    .filter((c) => !allCategories.includes(c))
                    .map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]} (new)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-desc">Description</Label>
              <Input
                id="permission-desc"
                placeholder="Brief description of this permission"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim() || isSaving}>
              {isSaving
                ? editingPermission
                  ? 'Updating...'
                  : 'Creating...'
                : editingPermission
                  ? 'Update Permission'
                  : 'Create Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingPermission}
        onOpenChange={(open) => !open && setDeletingPermission(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPermission?.name}"?
              This may affect roles that use this permission and will change navigation access for users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPermission && deleteMutation.mutate(deletingPermission.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
