import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Zap, Trash2, Pencil, UserCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { radiusUserApi } from '@/api/radiusUserApi'
import { toast } from 'sonner'
import { formatApiError } from '@/utils/errorHandler'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface OverviewTabProps {
  user: {
    id?: number
    uuid?: string
    username?: string
    email?: string
    firstname?: string
    lastname?: string
    phone?: string
    enabled?: boolean
    profileName?: string
    groupName?: string
    createdAt?: string
    updatedAt?: string
  }
  onActivate?: () => void
  onDelete?: () => void
  deleteDialogOpen?: boolean
  onDeleteCancel?: () => void
  onDeleteConfirm?: () => void
  isDeleting?: boolean
}

export function OverviewTab({ 
  user, 
  onActivate, 
  onDelete,
  deleteDialogOpen = false,
  onDeleteCancel,
  onDeleteConfirm,
  isDeleting = false
}: OverviewTabProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [changeUsernameDialogOpen, setChangeUsernameDialogOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')

  const handleEdit = () => {
    if (user.uuid) {
      navigate(`/radius/users/${user.uuid}/edit`)
    }
  }

  const changeUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      if (!user.uuid) throw new Error('Missing user UUID')
      return radiusUserApi.changeUsernameByUuid(user.uuid, username)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['radius-user'] })
      toast.success(data.message || 'Username changed successfully')
      setChangeUsernameDialogOpen(false)
      setNewUsername('')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to change username')
    },
  })

  const handleChangeUsername = () => {
    if (!newUsername.trim()) {
      toast.error('Please enter a new username')
      return
    }
    changeUsernameMutation.mutate(newUsername)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Overview</CardTitle>
              <CardDescription>Basic information about the user</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEdit} variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {onActivate && (
                <Button onClick={onActivate} size="sm">
                  <Zap className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              )}
              {onDelete && (
                <Button onClick={onDelete} variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Username</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-primary">{user.username || '-'}</p>
                <Button 
                  onClick={() => setChangeUsernameDialogOpen(true)} 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2"
                >
                  <UserCog className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-sm">{user.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">First Name</p>
              <p className="text-sm">{user.firstname || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Name</p>
              <p className="text-sm">{user.lastname || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="text-sm">{user.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={user.enabled ? 'default' : 'secondary'}>
                {user.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Profile</p>
              <p className="text-sm">{user.profileName || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Group</p>
              <p className="text-sm">{user.groupName || '-'}</p>
            </div>
            {user.createdAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created At</p>
                <p className="text-sm">{new Date(user.createdAt).toLocaleString()}</p>
              </div>
            )}
            {user.updatedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Updated At</p>
                <p className="text-sm">{new Date(user.updatedAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user "{user.username}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Username Dialog */}
      <Dialog open={changeUsernameDialogOpen} onOpenChange={setChangeUsernameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Username</DialogTitle>
            <DialogDescription>
              Enter a new username for {user.username}. This will update the username in both the user record and authentication system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="current-username">Current Username</Label>
              <Input id="current-username" value={user.username || ''} disabled />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-username">New Username</Label>
              <Input 
                id="new-username" 
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                disabled={changeUsernameMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setChangeUsernameDialogOpen(false)
                setNewUsername('')
              }}
              disabled={changeUsernameMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleChangeUsername}
              disabled={changeUsernameMutation.isPending || !newUsername.trim()}
            >
              {changeUsernameMutation.isPending ? 'Changing...' : 'Change Username'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
