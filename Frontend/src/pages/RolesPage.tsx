import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userManagementApi, type Role, type Permission } from '@/api/userManagementApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { Plus, Trash2, Pencil, RotateCcw, Users, Lock } from 'lucide-react'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'

export default function RolesPage() {
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deletingRole, setDeletingRole] = useState<Role | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<string>('Shield')
  const [selectedColor, setSelectedColor] = useState<string>('#3b82f6')
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([])
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', showDeleted],
    queryFn: () => userManagementApi.getRoles(showDeleted),
  })

  const { data: permissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['permissions', false],
    queryFn: () => userManagementApi.getPermissions(false),
    staleTime: 30 * 1000, // Cache for 30 seconds
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
      setSelectedIcon('Shield')
      setSelectedColor('#3b82f6')
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
      setDeletingRole(null)
      toast.success('Role deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete role')
    },
  })

  const confirmDelete = () => {
    if (deletingRole) {
      deleteRoleMutation.mutate(deletingRole.id)
    }
  }

  const restoreRoleMutation = useMutation({
    mutationFn: userManagementApi.restoreRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to restore role')
    },
  })

  const assignPermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
      userManagementApi.assignPermissionsToRole(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Permissions updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update permissions')
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      userManagementApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setEditingRole(null)
      setSelectedPermissions([])
      toast.success('Role updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update role')
    },
  })

  const handleSaveRole = async () => {
    if (!editingRole) return
    
    // Update role details (name, description, icon, color)
    await updateRoleMutation.mutateAsync({
      id: editingRole.id,
      data: {
        name: editingRole.name,
        description: editingRole.description,
        icon: selectedIcon,
        color: selectedColor
      }
    })
    
    // Update permissions
    await assignPermissionsMutation.mutateAsync({
      roleId: editingRole.id,
      permissionIds: selectedPermissions
    })
    
    setEditingRole(null)
    setSelectedPermissions([])
  }

  const openEditDialog = async (role: Role) => {
    setEditingRole(role)
    setSelectedIcon(role.icon || 'Shield')
    setSelectedColor(role.color || '#3b82f6')
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
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "secondary" : "outline"}
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {showDeleted ? 'Show Active' : 'Show Deleted'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      {rolesLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(role => {
            const RoleIcon = getIconComponent(role.icon)
            const roleColor = role.color || '#3b82f6'
            
            return (
              <Card key={role.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="p-2.5 rounded-lg flex items-center justify-center" 
                        style={{ backgroundColor: `${roleColor}15`, color: roleColor }}
                      >
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{role.name}</CardTitle>
                        {role.description && (
                          <CardDescription className="mt-1 line-clamp-2">{role.description}</CardDescription>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {role.userCount !== undefined && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                            </Badge>
                          )}
                          {role.permissionCount !== undefined && (
                            <Badge variant="outline" className="text-xs">
                              <Lock className="h-3 w-3 mr-1" />
                              {role.permissionCount} {role.permissionCount === 1 ? 'permission' : 'permissions'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreRoleMutation.mutate(role.id)}
                          disabled={restoreRoleMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingRole(role)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}

          {roles.length === 0 && (
            <Card className="col-span-full">
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

            {/* Icon and Color Picker */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen} modal={true}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      {(() => {
                        const IconComponent = getIconComponent(selectedIcon)
                        return <IconComponent className="h-4 w-4" style={{ color: selectedColor }} />
                      })()}
                      <span>{selectedIcon}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" sideOffset={5} style={{ zIndex: 9999 }}>
                    <div className="grid grid-cols-6 gap-2 p-3 max-h-60 overflow-y-auto">
                      {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                        <button
                          key={name}
                          onClick={() => {
                            setSelectedIcon(name)
                            setIconPopoverOpen(false)
                          }}
                          className={`flex h-10 w-10 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground ${
                            selectedIcon === name ? 'bg-accent' : ''
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue>
                      {PREDEFINED_COLORS.find(c => c.value === selectedColor)?.label || 'Select color'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_COLORS.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
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
              onClick={() => createRoleMutation.mutate({ 
                name: newRoleName, 
                description: newRoleDesc,
                icon: selectedIcon,
                color: selectedColor
              })}
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
            <DialogTitle>Edit Role: {editingRole?.name}</DialogTitle>
            <DialogDescription>
              Update role details and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Icon and Color Picker */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      {(() => {
                        const IconComponent = getIconComponent(selectedIcon)
                        return <IconComponent className="h-4 w-4" style={{ color: selectedColor }} />
                      })()}
                      <span>{selectedIcon}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start" sideOffset={5} style={{ zIndex: 9999 }}>
                    <div className="grid grid-cols-6 gap-2 p-3 max-h-60 overflow-y-auto">
                      {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                        <button
                          key={name}
                          onClick={() => setSelectedIcon(name)}
                          className={`flex h-10 w-10 items-center justify-center rounded-md border hover:bg-accent hover:text-accent-foreground ${
                            selectedIcon === name ? 'bg-accent' : ''
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={selectedColor} onValueChange={setSelectedColor}>
                  <SelectTrigger>
                    <SelectValue>
                      {PREDEFINED_COLORS.find(c => c.value === selectedColor)?.label || 'Select color'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_COLORS.map(color => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => editingRole && handleSaveRole(editingRole.id)}
              disabled={updateRoleMutation.isPending || assignPermissionsMutation.isPending}
            >
              {(updateRoleMutation.isPending || assignPermissionsMutation.isPending) ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingRole?.name}"? This action can be undone later by restoring the role.
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
