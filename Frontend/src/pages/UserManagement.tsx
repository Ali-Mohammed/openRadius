import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, RefreshCw, Users as UsersIcon, Shield, X, Download, Plus, Trash2 } from 'lucide-react'
import { userManagementApi, type User } from '@/api/userManagementApi'
import { formatApiError } from '@/utils/errorHandler'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

export default function UserManagement() {
  const queryClient = useQueryClient()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [showGroupDialog, setShowGroupDialog] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDesc, setNewRoleDesc] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | undefined>(undefined)

  // Queries
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementApi.getAll(),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => userManagementApi.getGroups(),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userManagementApi.getRoles(),
  })

  // Mutations
  const syncUsersMutation = useMutation({
    mutationFn: () => userManagementApi.syncKeycloakUsers(),
    onSuccess: (data) => {
      toast.success(`Synced ${data.syncedCount} new users, updated ${data.updatedCount} users`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const updateSupervisorMutation = useMutation({
    mutationFn: ({ userId, supervisorId }: { userId: number; supervisorId?: number }) =>
      userManagementApi.updateSupervisor(userId, { supervisorId }),
    onSuccess: () => {
      toast.success('Supervisor updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const createRoleMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      userManagementApi.createRole(data),
    onSuccess: () => {
      toast.success('Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      setShowRoleDialog(false)
      setNewRoleName('')
      setNewRoleDesc('')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: number) => userManagementApi.deleteRole(id),
    onSuccess: () => {
      toast.success('Role deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['roles'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const createGroupMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      userManagementApi.createGroup(data),
    onSuccess: () => {
      toast.success('Group created successfully')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setShowGroupDialog(false)
      setNewGroupName('')
      setNewGroupDesc('')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => userManagementApi.deleteGroup(id),
    onSuccess: () => {
      toast.success('Group deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      userManagementApi.assignRolesToUser(userId, roleIds),
    onSuccess: () => {
      toast.success('Roles updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const assignGroupsMutation = useMutation({
    mutationFn: ({ userId, groupIds }: { userId: number; groupIds: number[] }) =>
      userManagementApi.assignGroupsToUser(userId, groupIds),
    onSuccess: () => {
      toast.success('Groups updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setSelectedRoleIds(user.roles?.map(r => r.id) || [])
      setSelectedGroupIds(user.groups?.map(g => g.id) || [])
      setSelectedSupervisorId(user.supervisorId || undefined)
    } else {
      setEditingUser(null)
      setSelectedRoleIds([])
      setSelectedGroupIds([])
      setSelectedSupervisorId(undefined)
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
  }

  const handleSave = async () => {
    if (!editingUser) {
      toast.error('No user selected for editing')
      return
    }

    try {
      await updateSupervisorMutation.mutateAsync({
        userId: editingUser.id,
        supervisorId: selectedSupervisorId,
      })

      await assignRolesMutation.mutateAsync({
        userId: editingUser.id,
        roleIds: selectedRoleIds,
      })

      await assignGroupsMutation.mutateAsync({
        userId: editingUser.id,
        groupIds: selectedGroupIds,
      })

      toast.success('User updated successfully')
      handleCloseDialog()
    } catch (error: any) {
      toast.error(formatApiError(error))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage user permissions, roles, groups, and supervisors</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => syncUsersMutation.mutate()} 
            variant="default"
            disabled={syncUsersMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {syncUsersMutation.isPending ? 'Syncing...' : 'Sync Keycloak Users'}
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Roles Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles
              </h2>
              <p className="text-sm text-muted-foreground">Define user roles for permission management</p>
            </div>
            <Button onClick={() => setShowRoleDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Role
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles created yet. Click "Add Role" to create one.</p>
            ) : (
              roles.map((role) => (
                <Badge key={role.id} variant="outline" className="px-3 py-1 text-sm">
                  {role.name}
                  <button
                    onClick={() => deleteRoleMutation.mutate(role.id)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Groups Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Groups
              </h2>
              <p className="text-sm text-muted-foreground">Organize users into groups</p>
            </div>
            <Button onClick={() => setShowGroupDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups created yet. Click "Add Group" to create one.</p>
            ) : (
              groups.map((group) => (
                <Badge key={group.id} variant="secondary" className="px-3 py-1 text-sm">
                  {group.name}
                  <button
                    onClick={() => deleteGroupMutation.mutate(group.id)}
                    className="ml-2 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Users</h2>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Groups</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : user.email}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.supervisor ? (
                        <span className="text-sm">
                          {user.supervisor.firstName || user.supervisor.lastName
                            ? `${user.supervisor.firstName || ''} ${user.supervisor.lastName || ''}`.trim()
                            : user.supervisor.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">No supervisor</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.groups?.map((group) => (
                          <Badge key={group.id} variant="secondary">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles?.map((role) => (
                          <Badge key={role.id} variant="outline">
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => handleOpenDialog(user)}
                          variant="ghost"
                          size="icon"
                        >
                          <Pencil className="h-4 w-4" />
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

      {/* Edit User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
            <DialogDescription>
              Update user's supervisor, roles, and groups
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingUser && (
              <div className="grid gap-2">
                <Label>User</Label>
                <div className="text-sm">
                  <div className="font-medium">
                    {editingUser.firstName || editingUser.lastName
                      ? `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim()
                      : 'N/A'}
                  </div>
                  <div className="text-muted-foreground">{editingUser.email}</div>
                </div>
              </div>
            )}
            
            {/* Supervisor Selection */}
            <div className="grid gap-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select
                value={selectedSupervisorId?.toString()}
                onValueChange={(value) => setSelectedSupervisorId(value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a supervisor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => u.id !== editingUser?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : user.email || 'Unknown'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedSupervisorId && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedSupervisorId(undefined)}
                  className="text-xs w-fit"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear supervisor
                </Button>
              )}
            </div>

            {/* Groups Selection */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <UsersIcon className="h-4 w-4" />
                Groups
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No groups available</p>
                ) : (
                  groups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroupIds.includes(group.id)}
                        onCheckedChange={(checked) => {
                          setSelectedGroupIds(
                            checked
                              ? [...selectedGroupIds, group.id]
                              : selectedGroupIds.filter(id => id !== group.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`group-${group.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {group.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Roles Selection */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Roles
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles available</p>
                ) : (
                  roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRoleIds(
                            checked
                              ? [...selectedRoleIds, role.id]
                              : selectedRoleIds.filter(id => id !== role.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Add a new role that can be assigned to users
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
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

      {/* Add Group Dialog */}
      <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Add a new group that users can be assigned to
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g., Engineering, Sales, Support"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-desc">Description</Label>
              <Input
                id="group-desc"
                placeholder="Brief description of this group"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createGroupMutation.mutate({ name: newGroupName, description: newGroupDesc })}
              disabled={!newGroupName.trim() || createGroupMutation.isPending}
            >
              {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
