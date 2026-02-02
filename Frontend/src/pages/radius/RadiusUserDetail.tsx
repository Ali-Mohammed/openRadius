import { useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { radiusUserApi } from '@/api/radiusUserApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

export default function RadiusUserDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentWorkspaceId } = useWorkspace()
  const activeTab = tab || 'overview'

  const { data: user, isLoading } = useQuery({
    queryKey: ['radius-user', currentWorkspaceId, id],
    queryFn: async () => {
      if (!id) throw new Error('Missing user ID')
      return radiusUserApi.getById(Number(id))
    },
    enabled: !!id,
  })

  // Update breadcrumb when user data is loaded
  useEffect(() => {
    if (user) {
      const username = user.firstname && user.lastname 
        ? `${user.firstname} ${user.lastname}` 
        : user.username || user.email || `User #${user.id}`
      
      const breadcrumbElement = document.getElementById('user-detail-breadcrumb')
      if (breadcrumbElement) {
        breadcrumbElement.textContent = username
        // Trigger breadcrumb update in AppLayout
        window.dispatchEvent(new Event('breadcrumb-update'))
      }
    }
  }, [user])

  // Redirect to overview tab if no tab is specified
  useEffect(() => {
    if (id && !tab && location.pathname === `/radius/users/${id}`) {
      navigate(`/radius/users/${id}/overview`, { replace: true })
    }
  }, [id, tab, location.pathname, navigate])

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">User not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto">
      {/* Hidden element for breadcrumb */}
      <span id="user-detail-breadcrumb" className="hidden"></span>
      

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => navigate(`/radius/users/${id}/${value}`)}>
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="freezonebtraffic">FreeZone Traffic</TabsTrigger>
          <TabsTrigger value="quota">Quota</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
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
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit">
          <Card>
            <CardHeader>
              <CardTitle>Edit User</CardTitle>
              <CardDescription>Modify user information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Edit functionality will be implemented here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Traffic Tab */}
        <TabsContent value="traffic">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Usage</CardTitle>
              <CardDescription>View user's data traffic statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Traffic statistics will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>User Sessions</CardTitle>
              <CardDescription>Active and historical session information</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Session history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>User billing invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Invoice list will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>User payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Payment history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>User activity and changes log</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Activity history will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>User-related documents and files</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Documents will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FreeZone Traffic Tab */}
        <TabsContent value="freezonebtraffic">
          <Card>
            <CardHeader>
              <CardTitle>FreeZone Traffic</CardTitle>
              <CardDescription>Traffic in designated free zones</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">FreeZone traffic data will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quota Tab */}
        <TabsContent value="quota">
          <Card>
            <CardHeader>
              <CardTitle>Quota Management</CardTitle>
              <CardDescription>User data and time quotas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Quota information will be displayed here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
