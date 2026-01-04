import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userManagementApi, type Role, type Permission } from '@/api/userManagementApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Plus, Trash2, Shield, Lock, Settings } from 'lucide-react'

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: userManagementApi.getRoles,
  })

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: userManagementApi.getPermissions,
  })

  const createRoleMutation = useMutation({
    mutationFn: userManagementApi.createRole,
    onSuccess: async (newRole) => {
      if (selectedPermissions.length > 0) {
        await userManagementApi.assignPermissionsToRole(newRole.id, selectedPermissions)
      }
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowCreateDialog(false)
      setNewRoleName('')
      setNewRoleDesc('')
      setSelectedPermissions([])
      toast.success('Role created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create role')
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: userManagementApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete role')
    },
  })

  const assignPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
      userManagementApi.assignPermissionsToRole(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setEditingRole(null)
      setSelectedPermissions([])
      toast.success('Permissions updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update permissions')
    },
  })

  const openEditDialog = async (role: Role) => {
    setEditingRole(role)
    try {
      const rolePermissions = await userManagementApi.getRolePermissions(role.id)
      setSelectedPermissions(rolePermissions.map(p => p.id))
    } catch (error) {
      console.error('Failed to load role permissions', error)
      setSelectedPermissions([])
    }
  }

  const handlePermissionToggle = (permissionId: number) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(id => id !== permissionId)
        : [...prev, permissionId]
    )
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
          <h1 className="text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground">Manage user roles and their permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {rolesLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {roles.map(role => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle>{role.name}</CardTitle>
                      {role.description && (
                        <CardDescription className="mt-1">{role.description}</CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(role)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Permissions
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteRoleMutation.mutate(role.id)}
                      disabled={deleteRoleMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {roles.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No roles created yet. Click "Add Role" to create one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create Role Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new role and assign permissions to it
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="role-name">Role Name *</Label>
              <Input
                id="role-name"
                placeholder="e.g., Admin, Manager, Viewer"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                placeholder="Brief description of this role"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">Permissions</Label>
              {permissionsLoading ? (
                <p className="text-sm text-muted-foreground">Loading permissions...</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <div key={category} className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {category}
                      </p>
                      <div className="ml-6 space-y-2">
                        {categoryPermissions.map(permission => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`perm-${permission.id}`}
                              checked={selectedPermissions.includes(permission.id)}
                              onCheckedChange={() => handlePermissionToggle(permission.id)}
                            />
                            <label
                              htmlFor={`perm-${permission.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {permission.name}
                              {permission.description && (
                                <span className="text-muted-foreground ml-2">- {permission.description}</span>
                              )}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {permissions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No permissions available. Create permissions first.</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createRoleMutation.mutate({ name: newRoleName, description: newRoleDesc })}
              disabled={!newRoleName.trim() || createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Permissions Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Permissions for {editingRole?.name}</DialogTitle>
            <DialogDescription>
              Select the permissions for this role
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {permissionsLoading ? (
              <p className="text-sm text-muted-foreground">Loading permissions...</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                  <div key={category} className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      {category}
                    </p>
                    <div className="ml-6 space-y-2">
                      {categoryPermissions.map(permission => (
                        <div key={permission.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-perm-${permission.id}`}
                            checked={selectedPermissions.includes(permission.id)}
                            onCheckedChange={() => handlePermissionToggle(permission.id)}
                          />
                          <label
                            htmlFor={`edit-perm-${permission.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {permission.name}
                            {permission.description && (
                              <span className="text-muted-foreground ml-2">- {permission.description}</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingRole && assignPermissionsMutation.mutate({
                roleId: editingRole.id,
                permissionIds: selectedPermissions
              })}
              disabled={assignPermissionsMutation.isPending}
            >
              {assignPermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
