import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Pencil, RefreshCw, Download, Users, Shield, X, UserPlus, Key, UserX, UserCheck, UserCog } from 'lucide-react'
import { userManagementApi, type User } from '@/api/userManagementApi'
import { formatApiError } from '@/utils/errorHandler'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [refreshKey, setRefreshKey] = useState(Date.now())

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState(true)
  
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | undefined>(undefined)
  
  // Form fields for creating a new user
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  // Force refetch on mount
  useEffect(() => {
    setRefreshKey(Date.now())
  }, [])

  // Queries
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['users', refreshKey],
    queryFn: async () => {
      const data = await userManagementApi.getAll()
      console.log('Users data received:', data)
      console.log('First user:', data[0])
      return data
    },
    staleTime: 0,
    gcTime: 0,
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

  const createUserMutation = useMutation({
    mutationFn: userManagementApi.createUser,
    onSuccess: () => {
      toast.success('User created successfully')
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

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password, temporary }: { userId: string; password: string; temporary: boolean }) =>
      userManagementApi.resetPassword(userId, { password, temporary }),
    onSuccess: () => {
      toast.success('Password reset successfully')
      setIsPasswordDialogOpen(false)
      setResetPasswordUser(null)
      setNewPassword('')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, enabled }: { userId: string; enabled: boolean }) =>
      userManagementApi.toggleUserStatus(userId, enabled),
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.enabled ? 'enabled' : 'disabled'} successfully`)
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
      // Creating new user
      setEditingUser(null)
      setFirstName('')
      setLastName('')
      setEmail('')
      setSelectedRoleIds([])
      setSelectedGroupIds([])
      setSelectedSupervisorId(undefined)
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
    setFirstName('')
    setLastName('')
    setEmail('')
  }

  const handleSave = async () => {
    if (editingUser) {
      // Editing existing user
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
    } else {
      // Creating new user
      if (!email) {
        toast.error('Email is required')
        return
      }

      try {
        await createUserMutation.mutateAsync({
          firstName,
          lastName,
          email,
          supervisorId: selectedSupervisorId,
          roleIds: selectedRoleIds,
          groupIds: selectedGroupIds,
        })

        handleCloseDialog()
      } catch (error: any) {
        toast.error(formatApiError(error))
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage users and assign roles, groups, and supervisors</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => handleOpenDialog()} 
            variant="default"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Button 
            onClick={() => syncUsersMutation.mutate()} 
            variant="outline"
            disabled={syncUsersMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {syncUsersMutation.isPending ? 'Syncing...' : 'Sync Keycloak Users'}
          </Button>
          <Button 
            onClick={() => {
              setRefreshKey(Date.now())
              queryClient.invalidateQueries({ queryKey: ['users'] })
            }} 
            variant="outline" 
            size="icon"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                  <TableHead>Status</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead>Groups</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={user.enabled === false ? 'opacity-60' : ''}>
                    <TableCell>
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : user.email}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.enabled !== false ? "outline" : "secondary"}
                        className={user.enabled !== false ? "border-green-600 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400" : "border-red-600 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-400"}
                      >
                        {user.enabled !== false ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
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
                          title="Edit user"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            setResetPasswordUser(user)
                            setIsPasswordDialogOpen(true)
                            setNewPassword('')
                            setTemporaryPassword(true)
                          }}
                          variant="ghost"
                          size="icon"
                          title="Reset password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => {
                            if (user.keycloakUserId) {
                              userManagementApi.impersonateUser(user.keycloakUserId)
                                .then((response) => {
                                  if (response.impersonationUrl) {
                                    window.open(response.impersonationUrl, '_blank')
                                    toast.success(`Impersonating ${user.firstName} ${user.lastName}`)
                                  }
                                })
                                .catch((error) => {
                                  toast.error(formatApiError(error))
                                })
                            }
                          }}
                          variant="ghost"
                          size="icon"
                          title="Impersonate user"
                        >
                          <UserCog className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button
                          onClick={() => {
                            if (user.keycloakUserId) {
                              toggleUserStatusMutation.mutate({
                                userId: user.keycloakUserId,
                                enabled: user.enabled === false,
                              })
                            }
                          }}
                          variant="ghost"
                          size="icon"
                          title={user.enabled !== false ? 'Disable user' : 'Enable user'}
                          disabled={toggleUserStatusMutation.isPending}
                        >
                          {user.enabled !== false ? (
                            <UserX className="h-4 w-4 text-red-600" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-600" />
                          )}
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

      {/* Edit/Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User Permissions' : 'Create New User'}</DialogTitle>
            <DialogDescription>
              {editingUser 
                ? "Update user's supervisor, roles, and groups" 
                : "Create a new user and assign supervisor, roles, and groups"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingUser ? (
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
            ) : (
              <>
                {/* New User Form Fields */}
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </>
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
                <Users className="h-4 w-4" />
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
            <Button onClick={handleSave} disabled={!editingUser && !email}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {resetPasswordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="temporary"
                checked={temporaryPassword}
                onCheckedChange={(checked) => setTemporaryPassword(checked as boolean)}
              />
              <label
                htmlFor="temporary"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Require password change on next login
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false)
                setResetPasswordUser(null)
                setNewPassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resetPasswordUser && newPassword) {
                  resetPasswordMutation.mutate({
                    userId: resetPasswordUser.keycloakId,
                    password: newPassword,
                    temporary: temporaryPassword,
                  })
                }
              }}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
