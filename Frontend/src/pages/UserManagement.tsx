import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, RefreshCw, Search, Key } from 'lucide-react'
import { userManagementApi, type KeycloakUser, type CreateUserRequest } from '@/api/userManagementApi'
import { formatApiError } from '@/utils/errorHandler'

export default function UserManagement() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<KeycloakUser | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<string | null>(null)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [userToResetPassword, setUserToResetPassword] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    enabled: true,
    emailVerified: false,
    password: '',
    temporaryPassword: false,
  })

  const [passwordData, setPasswordData] = useState({
    password: '',
    temporary: false,
  })

  // Queries
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['keycloak-users', searchQuery],
    queryFn: () => userManagementApi.getAll(0, 100, searchQuery || undefined),
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['keycloak-groups'],
    queryFn: () => userManagementApi.getGroups(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateUserRequest) => userManagementApi.create(data),
    onSuccess: () => {
      toast.success('User created successfully')
      queryClient.invalidateQueries({ queryKey: ['keycloak-users'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KeycloakUser> }) =>
      userManagementApi.update(id, data),
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['keycloak-users'] })
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userManagementApi.delete(id),
    onSuccess: () => {
      toast.success('User deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['keycloak-users'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password, temporary }: { id: string; password: string; temporary: boolean }) =>
      userManagementApi.resetPassword(id, { password, temporary }),
    onSuccess: () => {
      toast.success('Password reset successfully')
      setResetPasswordDialogOpen(false)
      setPasswordData({ password: '', temporary: false })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const handleSearch = () => {
    setSearchQuery(searchInput)
  }

  const handleOpenDialog = (user?: KeycloakUser) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username || '',
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        enabled: user.enabled,
        emailVerified: user.emailVerified || false,
      })
    } else {
      setEditingUser(null)
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        enabled: true,
        emailVerified: false,
        password: '',
        temporaryPassword: false,
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
  }

  const handleSave = () => {
    if (!formData.username) {
      toast.error('Username is required')
      return
    }

    if (editingUser && editingUser.id) {
      updateMutation.mutate({ 
        id: editingUser.id, 
        data: {
          username: formData.username,
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          enabled: formData.enabled,
          emailVerified: formData.emailVerified,
        }
      })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (id: string) => {
    setUserToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  const handleResetPassword = (id: string) => {
    setUserToResetPassword(id)
    setResetPasswordDialogOpen(true)
  }

  const confirmResetPassword = () => {
    if (userToResetPassword && passwordData.password) {
      resetPasswordMutation.mutate({
        id: userToResetPassword,
        password: passwordData.password,
        temporary: passwordData.temporary,
      })
    } else {
      toast.error('Password is required')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage Keycloak users</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search users..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-sm"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email Verified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>
                      {user.firstName || user.lastName 
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.enabled ? 'default' : 'secondary'}>
                        {user.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                        {user.emailVerified ? 'Verified' : 'Not Verified'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResetPassword(user.id!)}
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(user.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Update user information' : 'Add a new user to Keycloak'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!editingUser}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            {!editingUser && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password {!editingUser && '*'}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="temporaryPassword"
                    checked={formData.temporaryPassword}
                    onCheckedChange={(checked) => setFormData({ ...formData, temporaryPassword: checked })}
                  />
                  <Label htmlFor="temporaryPassword">Temporary Password</Label>
                </div>
              </>
            )}
            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="emailVerified"
                checked={formData.emailVerified}
                onCheckedChange={(checked) => setFormData({ ...formData, emailVerified: checked })}
              />
              <Label htmlFor="emailVerified">Email Verified</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for the user
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.password}
                onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="temporary"
                checked={passwordData.temporary}
                onCheckedChange={(checked) => setPasswordData({ ...passwordData, temporary: checked })}
              />
              <Label htmlFor="temporary">Temporary Password (user must change on first login)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmResetPassword}>Reset Password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user from Keycloak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
