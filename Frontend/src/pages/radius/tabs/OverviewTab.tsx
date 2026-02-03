import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Zap, Trash2, Pencil, UserCog, UserPen } from 'lucide-react'
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
    balance?: number
    loanBalance?: number
    expiration?: string
    lastOnline?: string
    remainingDays?: number
    debtDays?: number
    city?: string
    company?: string
    address?: string
    contractId?: string
    staticIp?: string
    zoneName?: string
    zoneColor?: string
    onlineStatus?: number
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
            <div className="inline-flex items-center rounded-md shadow-sm" role="group">
              <Button 
                onClick={handleEdit} 
                variant="outline" 
                size="sm"
                className="rounded-r-none border-r-0"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button 
                onClick={() => setChangeUsernameDialogOpen(true)} 
                variant="outline" 
                size="sm"
                className={`rounded-none ${onActivate ? 'border-r-0' : ''}`}
              >
                <UserPen className="h-4 w-4 mr-2" />
                Change Username
              </Button>
              {onActivate && (
                <Button 
                  onClick={onActivate} 
                  variant="outline"
                  size="sm"
                  className="rounded-none border-r-0"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              )}
              {onDelete && (
                <Button 
                  onClick={onDelete} 
                  variant="destructive" 
                  size="sm"
                  className="rounded-l-none"
                >
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
              <p className="text-sm font-bold text-primary">{user.username || '-'}</p>
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
              <p className="text-sm font-medium text-muted-foreground">City</p>
              <p className="text-sm">{user.city || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={user.enabled ? 'default' : 'secondary'}>
                {user.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {user.expiration && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Expiration Date</p>
                <p className="text-sm font-semibold">{new Date(user.expiration).toLocaleDateString()}</p>
              </div>
            )}
            {user.remainingDays !== undefined && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Remaining Days</p>
                <p className="text-sm">
                  <Badge variant={user.remainingDays > 7 ? 'default' : user.remainingDays > 0 ? 'secondary' : 'destructive'}>
                    {user.remainingDays} days
                  </Badge>
                </p>
              </div>
            )}
            {user.balance !== undefined && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Balance</p>
                <p className="text-sm font-semibold">${user.balance.toFixed(2)}</p>
              </div>
            )}
            {user.loanBalance !== undefined && user.loanBalance > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Loan Balance</p>
                <p className="text-sm font-semibold text-destructive">${user.loanBalance.toFixed(2)}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Profile</p>
              <p className="text-sm">{user.profileName || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Group</p>
              <p className="text-sm">{user.groupName || '-'}</p>
            </div>
            {user.zoneName && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Zone</p>
                <div className="flex items-center gap-2">
                  {user.zoneColor && (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: user.zoneColor }}
                    />
                  )}
                  <p className="text-sm">{user.zoneName}</p>
                </div>
              </div>
            )}
            {user.company && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Company</p>
                <p className="text-sm">{user.company}</p>
              </div>
            )}
            {user.address && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Address</p>
                <p className="text-sm">{user.address}</p>
              </div>
            )}
            {user.contractId && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contract ID</p>
                <p className="text-sm">{user.contractId}</p>
              </div>
            )}
            {user.staticIp && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Static IP</p>
                <p className="text-sm font-mono">{user.staticIp}</p>
              </div>
            )}
            {user.lastOnline && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Online</p>
                <p className="text-sm">{new Date(user.lastOnline).toLocaleString()}</p>
              </div>
            )}
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
