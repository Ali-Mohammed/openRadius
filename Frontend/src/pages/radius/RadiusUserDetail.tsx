import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { radiusUserApi } from '@/api/radiusUserApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Skeleton } from '@/components/ui/skeleton'
import { formatApiError } from '@/utils/errorHandler'
import { UserActivationDialog } from '@/components/UserActivationDialog'
import { OverviewTab } from './tabs/OverviewTab'
import { EditTab } from './tabs/EditTab'
import { TrafficTab } from './tabs/TrafficTab'
import { SessionsTab } from './tabs/SessionsTab'
import { InvoicesTab } from './tabs/InvoicesTab'
import { PaymentsTab } from './tabs/PaymentsTab'
import { HistoryTab } from './tabs/HistoryTab'
import { DocumentsTab } from './tabs/DocumentsTab'
import { FreeZoneTrafficTab } from './tabs/FreeZoneTrafficTab'
import { QuotaTab } from './tabs/QuotaTab'

export default function RadiusUserDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const activeTab = tab || 'overview'
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activationDialogOpen, setActivationDialogOpen] = useState(false)

  const { data: user, isLoading } = useQuery({
    queryKey: ['radius-user', currentWorkspaceId, id],
    queryFn: async () => {
      if (!id) throw new Error('Missing user ID')
      return radiusUserApi.getById(Number(id))
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => radiusUserApi.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success('User deleted successfully')
      navigate('/radius/users')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete user')
    },
  })

  const handleDelete = () => {
    if (user?.id) {
      deleteMutation.mutate(user.id)
      setDeleteDialogOpen(false)
    }
  }

  const handleActivate = () => {
    setActivationDialogOpen(true)
  }

  // Update breadcrumb when user data is loaded
  useEffect(() => {
    if (user) {
      const username = user.username || user.email || `User #${user.id}`
      
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
          <OverviewTab 
            user={user} 
            onActivate={handleActivate}
            onDelete={() => setDeleteDialogOpen(true)}
            deleteDialogOpen={deleteDialogOpen}
            onDeleteCancel={() => setDeleteDialogOpen(false)}
            onDeleteConfirm={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit">
          <EditTab />
        </TabsContent>

        {/* Traffic Tab */}
        <TabsContent value="traffic">
          <TrafficTab userId={user.externalId} />
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <SessionsTab userId={user.externalId} />
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <InvoicesTab />
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <DocumentsTab />
        </TabsContent>

        {/* FreeZone Traffic Tab */}
        <TabsContent value="freezonebtraffic">
          <FreeZoneTrafficTab />
        </TabsContent>

        {/* Quota Tab */}
        <TabsContent value="quota">
          <QuotaTab />
        </TabsContent>
      </Tabs>

      {/* Activation Dialog */}
      <UserActivationDialog
        open={activationDialogOpen}
        onOpenChange={setActivationDialogOpen}
        user={user || null}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['radius-user', currentWorkspaceId, id] })
          queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
        }}
      />
    </div>
  )
}
