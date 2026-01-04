import { useState } from 'react'
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
import { toast } from 'sonner'
import { Plus, Trash2, Lock, Shield, RotateCcw } from 'lucide-react'

const CATEGORIES = ['Users', 'Workspaces', 'RADIUS', 'Reports', 'Settings', 'General']

export default function PermissionsPage() {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [deletingPermission, setDeletingPermission] = useState<Permission | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [newPermissionName, setNewPermissionName] = useState('')
  const [newPermissionDesc, setNewPermissionDesc] = useState('')
  const [newPermissionCategory, setNewPermissionCategory] = useState('General')

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['permissions', showDeleted],
    queryFn: () => userManagementApi.getPermissions(showDeleted),
  })

  const createPermissionMutation = useMutation({
    mutationFn: userManagementApi.createPermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      setShowCreateDialog(false)
      setNewPermissionName('')
      setNewPermissionDesc('')
      setNewPermissionCategory('General')
      toast.success('Permission created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create permission')
    },
  })

  const deletePermissionMutation = useMutation({
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

  const restorePermissionMutation = useMutation({
    mutationFn: userManagementApi.restorePermission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      toast.success('Permission restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to restore permission')
    },
  })

  const confirmDelete = () => {
    if (deletingPermission) {
      deletePermissionMutation.mutate(deletingPermission.id)
    }
  }

  const groupedPermissions = permissions.reduce((acc, permission) => {
    const category = permission.category || 'General'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(permission)
    return acc
  }, {} as Record<string, Permission[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Permissions</h1>
          <p className="text-muted-foreground">Define granular permissions for your application</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {showDeleted ? 'Show Active' : 'Show Deleted'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Permission
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-6">
          {CATEGORIES.map(category => {
            const categoryPermissions = groupedPermissions[category] || []
            if (categoryPermissions.length === 0) return null

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    {category}
                  </CardTitle>
                  <CardDescription>{categoryPermissions.length} permission{categoryPermissions.length !== 1 ? 's' : ''}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {categoryPermissions.map(permission => (
                      <div key={permission.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{permission.name}</span>
                          </div>
                          {permission.description && (
                            <p className="text-sm text-muted-foreground mt-1 ml-6">{permission.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingPermission(permission)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {permissions.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No permissions created yet. Click "Add Permission" to create one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Permission</DialogTitle>
            <DialogDescription>
              Add a new permission that can be assigned to roles
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="permission-name">Permission Name *</Label>
              <Input
                id="permission-name"
                placeholder="e.g., view_users, edit_workspace, delete_reports"
                value={newPermissionName}
                onChange={(e) => setNewPermissionName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-category">Category *</Label>
              <Select value={newPermissionCategory} onValueChange={setNewPermissionCategory}>
                <SelectTrigger id="permission-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="permission-desc">Description</Label>
              <Input
                id="permission-desc"
                placeholder="Brief description of this permission"
                value={newPermissionDesc}
                onChange={(e) => setNewPermissionDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createPermissionMutation.mutate({
                name: newPermissionName,
                description: newPermissionDesc,
                category: newPermissionCategory
              })}
              disabled={!newPermissionName.trim() || createPermissionMutation.isPending}
            >
              {createPermissionMutation.isPending ? 'Creating...' : 'Create Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPermission} onOpenChange={(open) => !open && setDeletingPermission(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingPermission?.name}"? This action cannot be undone and may affect roles that use this permission.
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
