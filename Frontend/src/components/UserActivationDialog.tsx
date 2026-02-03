import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Zap, Users, Package, DollarSign } from 'lucide-react'
import { type RadiusUser } from '@/api/radiusUserApi'
import { getProfiles, type BillingProfile } from '@/api/billingProfiles'
import { radiusActivationApi, type CreateRadiusActivationRequest } from '@/api/radiusActivationApi'
import userWalletApi from '@/api/userWallets'
import { userCashbackApi } from '@/api/userCashbackApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatApiError } from '@/utils/errorHandler'

interface UserActivationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: RadiusUser | null
  onSuccess?: () => void
}

export function UserActivationDialog({ open, onOpenChange, user, onSuccess }: UserActivationDialogProps) {
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const currencySymbol = '$'
  const formatCurrency = (value: number) => value.toFixed(2)

  const [activationFormData, setActivationFormData] = useState({
    billingProfileId: '',
    paymentMethod: 'Wallet',
    durationDays: '30',
    notes: '',
  })
  const [isOnBehalfActivation, setIsOnBehalfActivation] = useState(false)
  const [applyCashback, setApplyCashback] = useState(true)
  const [selectedPayerWalletId, setSelectedPayerWalletId] = useState('')

  // Billing profiles query
  const { data: billingProfilesData } = useQuery({
    queryKey: ['billing-profiles', currentWorkspaceId],
    queryFn: () => getProfiles({ includeDeleted: false }),
    enabled: !!currentWorkspaceId && open,
  })

  const billingProfiles = useMemo(() => {
    return billingProfilesData?.data?.filter((bp: BillingProfile) => bp.isActive) || []
  }, [billingProfilesData])

  // My wallet query
  const { data: myWallet, refetch: refetchWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => userWalletApi.getMyWallet(),
    enabled: open,
  })

  // All user wallets query for on-behalf activation
  const { data: allUserWalletsData, isLoading: isLoadingUserWallets } = useQuery({
    queryKey: ['all-user-wallets'],
    queryFn: () => userWalletApi.getAll(1, 999999),
    enabled: open && isOnBehalfActivation,
  })

  const selectedBillingProfile = useMemo(() => {
    if (!activationFormData.billingProfileId) return null
    return billingProfiles.find((bp: BillingProfile) => bp.id.toString() === activationFormData.billingProfileId)
  }, [activationFormData.billingProfileId, billingProfiles])

  const selectedPayerWallet = useMemo(() => {
    if (!selectedPayerWalletId || !allUserWalletsData?.data) return null
    return allUserWalletsData.data.find((w: any) => w.id?.toString() === selectedPayerWalletId)
  }, [selectedPayerWalletId, allUserWalletsData])

  // Cashback calculation query
  const { data: cashbackData } = useQuery({
    queryKey: ['cashback-calculation', selectedBillingProfile?.id, selectedPayerWallet?.userId],
    queryFn: async () => {
      if (!selectedBillingProfile || !selectedPayerWallet?.userId) return null
      return userCashbackApi.calculateCashback(selectedPayerWallet.userId, selectedBillingProfile.id)
    },
    enabled: !!selectedBillingProfile && !!selectedPayerWallet && isOnBehalfActivation,
  })

  const activationMutation = useMutation({
    mutationFn: (data: CreateRadiusActivationRequest) => radiusActivationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['radius-user'] })
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success('User activated successfully')
      onOpenChange(false)
      resetForm()
      onSuccess?.()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to activate user')
    },
  })

  const resetForm = () => {
    setActivationFormData({
      billingProfileId: '',
      paymentMethod: 'Wallet',
      durationDays: '30',
      notes: '',
    })
    setIsOnBehalfActivation(false)
    setApplyCashback(true)
    setSelectedPayerWalletId('')
  }

  // Auto-select billing profile when user changes
  useEffect(() => {
    if (!user || !open) return

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
    
    setActivationFormData(prev => ({
      ...prev,
      billingProfileId: autoSelectedBillingProfileId,
    }))
  }, [user, billingProfiles, open])

  const handleSubmit = () => {
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
      isActionBehalf: isOnBehalfActivation,
      payerUserId: isOnBehalfActivation && selectedPayerWallet?.userId ? selectedPayerWallet.userId : undefined,
      payerUsername: isOnBehalfActivation && selectedPayerWallet?.userName ? selectedPayerWallet.userName : undefined,
      applyCashback: applyCashback && cashbackData && cashbackData.cashbackAmount > 0,
    }

    activationMutation.mutate(activationRequest)
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

              {/* On-Behalf Activation Options */}
              {selectedBillingProfile && (
                <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="on-behalf-toggle" className="text-sm font-medium">
                        Activate on behalf of user
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Pay from a selected user's wallet and receive cashback
                      </p>
                    </div>
                    <Switch
                      id="on-behalf-toggle"
                      checked={isOnBehalfActivation}
                      onCheckedChange={(checked) => {
                        setIsOnBehalfActivation(checked)
                        if (!checked) {
                          setSelectedPayerWalletId('')
                        }
                      }}
                    />
                  </div>
                  {isOnBehalfActivation && (
                    <>
                      <div className="pt-2 border-t space-y-2">
                        <Label className="text-sm font-medium">Select Payer</Label>
                        <Select
                          value={selectedPayerWalletId}
                          onValueChange={setSelectedPayerWalletId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingUserWallets ? "Loading users..." : "Select a user with wallet"} />
                          </SelectTrigger>
                          <SelectContent>
                            {isLoadingUserWallets ? (
                              <div className="p-2 text-center text-muted-foreground text-sm">Loading...</div>
                            ) : allUserWalletsData?.data?.length === 0 ? (
                              <div className="p-2 text-center text-muted-foreground text-sm">No users with wallets found</div>
                            ) : (
                              allUserWalletsData?.data?.map((wallet: any) => (
                                <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                                  <div className="flex items-center justify-between w-full gap-4">
                                    <span>{wallet.userName || wallet.userEmail || `User #${wallet.userId}`}</span>
                                    <span className="text-muted-foreground text-xs">
                                      {currencySymbol} {formatCurrency(wallet.currentBalance)}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedPayerWallet && cashbackData && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div>
                            <Label htmlFor="cashback-toggle" className="text-sm font-medium">
                              Apply Cashback
                            </Label>
                            {cashbackData.cashbackAmount > 0 ? (
                              <p className="text-xs text-green-600">
                                {selectedPayerWallet.userName || 'Payer'} will receive {currencySymbol} {formatCurrency(cashbackData.cashbackAmount)} ({cashbackData.source})
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No cashback configured for this profile
                              </p>
                            )}
                          </div>
                          <Switch
                            id="cashback-toggle"
                            checked={applyCashback}
                            onCheckedChange={setApplyCashback}
                            disabled={!cashbackData || cashbackData.cashbackAmount <= 0}
                          />
                        </div>
                      )}
                    </>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!activationFormData.billingProfileId || activationMutation.isPending}
          >
            {activationMutation.isPending ? 'Activating...' : 'Activate User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
