import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Zap, Trash2, Pencil } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
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

interface OverviewTabProps {
  user: {
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
  const { id } = useParams<{ id: string }>()

  const handleEdit = () => {
    if (id) {
      navigate(`/radius/users/${id}/edit`)
    }
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
              <p className="text-sm font-medium text-muted-foreground">Username</p>
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
    </>
  )
}
