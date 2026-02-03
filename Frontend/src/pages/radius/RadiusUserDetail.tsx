import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Zap, Users, Package, DollarSign } from 'lucide-react'
import { radiusUserApi, type RadiusUser } from '@/api/radiusUserApi'
import { getProfiles, type BillingProfile } from '@/api/billingProfiles'
import { radiusActivationApi, type CreateRadiusActivationRequest } from '@/api/radiusActivationApi'
import userWalletApi from '@/api/userWallets'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Skeleton } from '@/components/ui/skeleton'
import { formatApiError } from '@/utils/errorHandler'
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
  const [activationFormData, setActivationFormData] = useState({
    billingProfileId: '',
    paymentMethod: 'Wallet',
    durationDays: '30',
    notes: '',
  })

  const currencySymbol = '$'
  const formatCurrency = (value: number) => value.toFixed(2)

  const { data: user, isLoading } = useQuery({
    queryKey: ['radius-user', currentWorkspaceId, id],
    queryFn: async () => {
      if (!id) throw new Error('Missing user ID')
      return radiusUserApi.getById(Number(id))
    },
    enabled: !!id,
  })

  // Billing profiles query for activation
  const { data: billingProfilesData } = useQuery({
    queryKey: ['billing-profiles', currentWorkspaceId],
    queryFn: () => getProfiles({ includeDeleted: false }),
    enabled: !!currentWorkspaceId && activationDialogOpen,
  })

  const billingProfiles = useMemo(() => {
    return billingProfilesData?.data?.filter((bp: BillingProfile) => bp.isActive) || []
  }, [billingProfilesData])

  const selectedBillingProfile = useMemo(() => {
    if (!activationFormData.billingProfileId) return null
    return billingProfiles.find((bp: BillingProfile) => bp.id.toString() === activationFormData.billingProfileId)
  }, [activationFormData.billingProfileId, billingProfiles])

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

  const activationMutation = useMutation({
    mutationFn: (data: CreateRadiusActivationRequest) => radiusActivationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-user', currentWorkspaceId, id] })
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success('User activated successfully')
      setActivationDialogOpen(false)
      setActivationFormData({
        billingProfileId: '',
        paymentMethod: 'Wallet',
        durationDays: '30',
        notes: '',
      })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to activate user')
    },
  })

  const handleDelete = () => {
    if (user?.id) {
      deleteMutation.mutate(user.id)
      setDeleteDialogOpen(false)
    }
  }

  const handleActivate = () => {
    if (!user) return
    
    // Auto-select billing profile based on user's current profile
    let autoSelectedBillingProfileId = ''
    
    if (user.profileBillingId) {
      const matchedByBillingId = billingProfiles.find(
        (bp: BillingProfile) => bp.id === user.profileBillingId && bp.isActive
      )
      if (matchedByBillingId) {
        autoSelectedBillingProfileId = matchedByBillingId.id.toString()
      }
    }
    
    if (!autoSelectedBillingProfileId && user.profileId) {
      const matchedByProfileId = billingProfiles.find(
        (bp: BillingProfile) => bp.radiusProfileId === user.profileId && bp.isActive
      )
      if (matchedByProfileId) {
        autoSelectedBillingProfileId = matchedByProfileId.id.toString()
      }
    }
    
    setActivationFormData({
      billingProfileId: autoSelectedBillingProfileId,
      paymentMethod: 'Wallet',
      durationDays: '30',
      notes: '',
    })
    setActivationDialogOpen(true)
  }

  const handleSubmitActivation = () => {
    if (!user || !activationFormData.billingProfileId) {
      toast.error('Please select a billing profile')
      return
    }

    if (!selectedBillingProfile) {
      toast.error('Selected billing profile not found')
      return
    }

    const durationDays = parseInt(activationFormData.durationDays) || 30
    const now = new Date()
    let baseDate = now
    
    if (user.expiration) {
      const currentExpireDate = new Date(user.expiration)
      if (currentExpireDate > now) {
        baseDate = currentExpireDate
      }
    }
    
    const nextExpireDate = new Date(baseDate)
    nextExpireDate.setDate(nextExpireDate.getDate() + durationDays)

    const activationRequest: CreateRadiusActivationRequest = {
      radiusUserId: user.id!,
      radiusProfileId: selectedBillingProfile.radiusProfileId,
      billingProfileId: selectedBillingProfile.id,
      nextExpireDate: nextExpireDate.toISOString(),
      amount: selectedBillingProfile.price || 0,
      type: 'Activation',
      paymentMethod: activationFormData.paymentMethod,
      durationDays: durationDays,
      source: 'Web',
      notes: activationFormData.notes || undefined,
    }

    activationMutation.mutate(activationRequest)
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
      <Dialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Activate User
            </DialogTitle>
            <DialogDescription>
              Activate this user with a billing profile
            </DialogDescription>
          </DialogHeader>

          {user && (
            <div className="overflow-y-auto flex-1 space-y-6">
              {/* User Information */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">User Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Username:</span>
                    <span className="ml-2 font-medium">{user.username}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">
                      {user.firstname || user.lastname 
                        ? `${user.firstname || ''} ${user.lastname || ''}`.trim()
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Balance:</span>
                    <span className="ml-2 font-medium">{currencySymbol} {formatCurrency(user.balance || 0)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Profile:</span>
                    <span className="ml-2 font-medium">{user.profileName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expiration:</span>
                    <span className="ml-2 font-medium">
                      {user.expiration 
                        ? new Date(user.expiration).toLocaleDateString()
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge 
                      variant={user.enabled ? 'default' : 'secondary'} 
                      className="ml-2"
                    >
                      {user.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Billing Profile Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Select Billing Profile</h3>
                </div>
                
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="billingProfile">Billing Profile <span className="text-destructive">*</span></Label>
                    <Select
                      value={activationFormData.billingProfileId}
                      onValueChange={(value) => setActivationFormData({
                        ...activationFormData,
                        billingProfileId: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a billing profile" />
                      </SelectTrigger>
                      <SelectContent>
                        {billingProfiles.map((bp: BillingProfile) => (
                          <SelectItem key={bp.id} value={bp.id.toString()}>
                            <div className="flex items-center justify-between w-full">
                              <span>{bp.name}</span>
                              <span className="ml-2 text-muted-foreground">
                                {currencySymbol} {formatCurrency(bp.price || 0)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Profile Details */}
                  {selectedBillingProfile && (
                    <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-sm">Profile Details</h4>
                        <div className="flex items-center gap-1 text-lg font-bold text-green-600">
                          <DollarSign className="h-5 w-5" />
                          {currencySymbol} {formatCurrency(selectedBillingProfile.price || 0)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Profile Name:</span>
                          <span className="ml-2 font-medium">{selectedBillingProfile.name}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Description:</span>
                          <span className="ml-2">{selectedBillingProfile.description || '-'}</span>
                        </div>
                      </div>
                      {selectedBillingProfile.addons && selectedBillingProfile.addons.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-xs text-muted-foreground">Addons:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedBillingProfile.addons.map((addon, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {addon.title} (+{currencySymbol} {formatCurrency(addon.price)})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Method & Duration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="paymentMethod">Payment Method</Label>
                      <Select
                        value={activationFormData.paymentMethod}
                        onValueChange={(value) => setActivationFormData({
                          ...activationFormData,
                          paymentMethod: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Wallet">Wallet</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="durationDays">Duration (days)</Label>
                      <Select
                        value={activationFormData.durationDays}
                        onValueChange={(value) => setActivationFormData({
                          ...activationFormData,
                          durationDays: value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 Days</SelectItem>
                          <SelectItem value="15">15 Days</SelectItem>
                          <SelectItem value="30">30 Days</SelectItem>
                          <SelectItem value="60">60 Days</SelectItem>
                          <SelectItem value="90">90 Days</SelectItem>
                          <SelectItem value="180">180 Days</SelectItem>
                          <SelectItem value="365">365 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Add any notes about this activation..."
                      value={activationFormData.notes}
                      onChange={(e) => setActivationFormData({
                        ...activationFormData,
                        notes: e.target.value
                      })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActivationDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitActivation}
              disabled={!activationFormData.billingProfileId || activationMutation.isPending}
            >
              {activationMutation.isPending ? 'Activating...' : 'Activate User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
