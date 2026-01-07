import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, TrendingUp, ArrowUpCircle, Check, ChevronsUpDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import topUpApi, { type TopUpRequest } from '@/api/topUp'
import { customWalletApi } from '@/api/customWallets'
import userWalletApi from '@/api/userWallets'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaceApi } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export default function TopUp() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const { i18n } = useTranslation()

  const [walletType, setWalletType] = useState<'custom' | 'user'>('custom')
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [formData, setFormData] = useState<TopUpRequest>({
    walletType: 'custom',
    amount: 0,
  })

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    if (currency === 'IQD') {
      return i18n.language === 'ar' ? 'د.ع' : 'IQD'
    }
    return '$'
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.settings?.currency)

  const { data: customWallets } = useQuery({
    queryKey: ['customWallets', 'all'],
    queryFn: () => customWalletApi.getAll({ pageSize: 100 }),
    enabled: walletType === 'custom',
  })

  const { data: userWallets } = useQuery({
    queryKey: ['userWallets', 'all'],
    queryFn: () => userWalletApi.getAll({ pageSize: 100 }),
    enabled: walletType === 'user',
  })

  // Mutations
  const topUpMutation = useMutation({
    mutationFn: (request: TopUpRequest) => {
      if (request.walletType === 'custom') {
        return topUpApi.customWallet(request)
      } else {
        return topUpApi.userWallet(request)
      }
    },
    onSuccess: (data) => {
      toast.success(
        `Successfully added ${currencySymbol}${data.amount.toFixed(2)}. New balance: ${currencySymbol}${data.balanceAfter.toFixed(2)}`
      )
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      
      // Reset form
      setFormData({
        walletType,
        amount: 0,
      })
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to process top-up'
      toast.error(errorMessage)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (walletType === 'custom' && !formData.customWalletId) {
      toast.error('Please select a custom wallet')
      return
    }

    if (walletType === 'user' && !formData.userWalletId) {
      toast.error('Please select a user wallet')
      return
    }

    topUpMutation.mutate(formData)
  }

  const selectedCustomWallet = customWallets?.data.find(
    (w) => w.id === formData.customWalletId
  )
  const selectedUserWallet = userWallets?.data.find(
    (w) => w.id === formData.userWalletId
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Wallet Top-Up</h1>
        <p className="text-muted-foreground">
          Add balance to custom wallets or user wallets
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top-Up Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5" />
              Add Balance
            </CardTitle>
            <CardDescription>
              Select a wallet and enter the amount to top up
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletType">Wallet Type *</Label>
                <Select
                  value={walletType}
                  onValueChange={(value: 'custom' | 'user') => {
                    setWalletType(value)
                    setFormData({
                      walletType: value,
                      amount: 0,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Wallet</SelectItem>
                    <SelectItem value="user">User Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {walletType === 'custom' ? (
                <div className="space-y-2">
                  <Label htmlFor="customWallet">Custom Wallet *</Label>
                  <Select
                    value={formData.customWalletId?.toString() || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, customWalletId: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {customWallets?.data.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: wallet.color }}
                            />
                            {wallet.name} - {currencySymbol}
                            {wallet.currentBalance.toFixed(2)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userSearchOpen}
                        className="w-full justify-between"
                      >
                        {formData.userWalletId
                          ? userWallets?.data.find((w) => w.id === formData.userWalletId)?.userName
                          : "Select user wallet..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search users..." />
                        <CommandList>
                          <CommandEmpty>No user found.</CommandEmpty>
                          <CommandGroup>
                            {userWallets?.data.map((wallet) => (
                              <CommandItem
                                key={wallet.id}
                                value={`${wallet.userName} ${wallet.userEmail}`}
                                onSelect={() => {
                                  setFormData({ ...formData, userWalletId: wallet.id })
                                  setUserSearchOpen(false)
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.userWalletId === wallet.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{wallet.userName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {wallet.userEmail} • {currencySymbol}
                                    {wallet.currentBalance.toFixed(2)}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currencySymbol}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  value={formData.reference || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, reference: e.target.value })
                  }
                  placeholder="Transaction reference (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  value={formData.reason || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="Reason for top-up (optional)"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={topUpMutation.isPending}
              >
                {topUpMutation.isPending ? (
                  'Processing...'
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Add {currencySymbol}
                    {formData.amount > 0 ? formData.amount.toFixed(2) : '0.00'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Current Balance Display */}
        {(selectedCustomWallet || selectedUserWallet) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Current Balance
              </CardTitle>
              <CardDescription>
                Balance information for selected wallet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCustomWallet && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Wallet Name</div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: selectedCustomWallet.color }}
                      />
                      <div className="font-medium">{selectedCustomWallet.name}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Type</div>
                    <div className="capitalize">{selectedCustomWallet.type}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                    <div className="text-2xl font-bold">
                      {currencySymbol}
                      {selectedCustomWallet.currentBalance.toFixed(2)}
                    </div>
                  </div>
                  {formData.amount > 0 && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">
                        New Balance (after top-up)
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {currencySymbol}
                        {(selectedCustomWallet.currentBalance + formData.amount).toFixed(2)}
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectedUserWallet && (
                <>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">User</div>
                    <div>
                      <div className="font-medium">{selectedUserWallet.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedUserWallet.userEmail}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                    <div className="text-2xl font-bold">
                      {currencySymbol}
                      {selectedUserWallet.currentBalance.toFixed(2)}
                    </div>
                  </div>
                  {formData.amount > 0 && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">
                        New Balance (after top-up)
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        {currencySymbol}
                        {(selectedUserWallet.currentBalance + formData.amount).toFixed(2)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
