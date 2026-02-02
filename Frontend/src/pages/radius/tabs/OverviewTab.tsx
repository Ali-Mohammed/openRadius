import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
}

export function OverviewTab({ user }: OverviewTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Overview</CardTitle>
        <CardDescription>Basic information about the user</CardDescription>
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
  )
}
