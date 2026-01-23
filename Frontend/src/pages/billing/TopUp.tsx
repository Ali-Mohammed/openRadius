import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, TrendingUp, ArrowUpCircle, Check, ChevronsUpDown, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import topUpApi, { type TopUpRequest } from '@/api/topUp'
import { customWalletApi } from '@/api/customWallets'
import userWalletApi from '@/api/userWallets'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaceApi } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

type WizardStep = 1 | 2 | 3 | 4

export default function TopUp() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const { layout } = useTheme()
  const { i18n } = useTranslation()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [walletType, setWalletType] = useState<'custom' | 'user'>('custom')
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)
  const [topUpResult, setTopUpResult] = useState<{ success: boolean; message: string; data?: any } | null>(null)
  const [amountInput, setAmountInput] = useState('')
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

  // Helper to format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.currency)

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
      setTopUpResult({
        success: true,
        message: `Successfully added ${currencySymbol}${data.amount.toFixed(2)}. New balance: ${currencySymbol}${data.balanceAfter.toFixed(2)}`,
        data
      })
      setCurrentStep(4)
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to process top-up'
      setTopUpResult({
        success: false,
        message: errorMessage
      })
      setCurrentStep(4)
    },
  })

  const handleNext = () => {
    if (currentStep === 1) {
      // Validate step 1
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
      setCurrentStep(2)
    } else if (currentStep === 2) {
      setCurrentStep(3)
    }
  }

  const handleBack = () => {
    if (currentStep > 1 && currentStep < 4) {
      setCurrentStep((prev) => (prev - 1) as WizardStep)
    }
  }

  const handleConfirm = () => {
    topUpMutation.mutate(formData)
  }

  const handleStartNew = () => {
    setCurrentStep(1)
    setTopUpResult(null)
    setConfirmChecked(false)
    setFormData({
      walletType,
      amount: 0,
    })
  }

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Wallet Top-Up</h1>
        <p className="text-muted-foreground">
          Add balance to custom wallets or user wallets
        </p>
      </div>

      {/* Step Indicator */}
      <div className={cn(
        layout === 'boxed' ? 'max-w-2xl mx-auto' : 'max-w-4xl mx-auto'
      )}>
        <div className="relative">
          {/* Progress Line Container */}
          <div className="absolute top-5 left-0 right-0 flex items-center">
            <div className="w-[12.5%]" /> {/* Space for half of first circle */}
            <div className="flex-1 h-0.5 bg-muted-foreground/20" />
            <div className="w-[12.5%]" /> {/* Space for half of last circle */}
          </div>
          
          {/* Active Progress Line */}
          <div className="absolute top-5 left-0 right-0 flex items-center">
            <div className="w-[12.5%]" /> {/* Space for half of first circle */}
            <div 
              className="h-0.5 bg-primary transition-all duration-500 ease-in-out"
              style={{ 
                width: currentStep === 1 ? '0%' : 
                       currentStep === 2 ? '33.33%' : 
                       currentStep === 3 ? '66.66%' : 
                       '100%' 
              }}
            />
          </div>

          {/* Steps Container */}
          <div className="relative flex justify-between items-start">
            {[
              { step: 1, label: 'Fill Information' },
              { step: 2, label: 'Review Details' },
              { step: 3, label: 'Confirm' },
              { step: 4, label: 'Result' }
            ].map(({ step, label }) => (
              <div key={step} className="flex flex-col items-center" style={{ width: '25%' }}>
                {/* Circle */}
                <div
                  className={cn(
                    "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all duration-300",
                    currentStep === step
                      ? "border-primary bg-primary text-primary-foreground shadow-lg scale-110"
                      : currentStep > step
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                >
                  {currentStep > step ? <Check className="h-5 w-5" /> : step}
                </div>
                
                {/* Label */}
                <p className={cn(
                  "mt-3 text-sm font-medium text-center px-2 transition-colors duration-300",
                  currentStep === step ? "text-primary" : "text-muted-foreground"
                )}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <Card className={cn(
        layout === 'boxed' ? 'max-w-3xl mx-auto' : 'w-full'
      )}>
        <CardHeader>
          <CardTitle>
            {currentStep === 1 && "Step 1: Fill Information"}
            {currentStep === 2 && "Step 2: Review Details"}
            {currentStep === 3 && "Step 3: Confirm Transaction"}
            {currentStep === 4 && "Result"}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Select wallet and enter top-up amount"}
            {currentStep === 2 && "Review your top-up details before confirming"}
            {currentStep === 3 && "Confirm to process the top-up transaction"}
            {currentStep === 4 && "Transaction result"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Step 1: Fill Information */}
          {currentStep === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="walletType">Wallet Type *</Label>
                <Select
                  value={walletType}
                  onValueChange={(value: 'custom' | 'user') => {
                    setWalletType(value)
                    setFormData({
                      walletType: value,
                      amount: formData.amount,
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
                            {wallet.name} - {currencySymbol} {formatCurrency(wallet.currentBalance)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>User Wallet *</Label>
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
                                    {wallet.userEmail} • {currencySymbol} {formatCurrency(wallet.currentBalance)}
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
                  type="text"
                  value={amountInput}
                  onChange={(e) => {
                    const value = e.target.value
                    // Remove all non-digit and non-decimal characters
                    const cleaned = value.replace(/[^0-9.]/g, '')
                    // Prevent multiple decimal points
                    const parts = cleaned.split('.')
                    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned
                    
                    setAmountInput(formatted)
                    const numValue = parseFloat(formatted) || 0
                    setFormData({ ...formData, amount: numValue })
                  }}
                  onBlur={() => {
                    // Format with commas on blur if there's a value
                    if (amountInput && !isNaN(parseFloat(amountInput))) {
                      const num = parseFloat(amountInput)
                      const formatted = new Intl.NumberFormat('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2
                      }).format(num)
                      setAmountInput(formatted)
                    }
                  }}
                  onFocus={() => {
                    // Remove commas on focus for easier editing
                    if (amountInput) {
                      const cleaned = amountInput.replace(/,/g, '')
                      setAmountInput(cleaned)
                    }
                  }}
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

              <div className="flex justify-end gap-2 pt-4">
                <Button type="submit">
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* Step 2: Review Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">Wallet Type</span>
                  <span className="font-medium capitalize">{walletType} Wallet</span>
                </div>
                
                {selectedCustomWallet && (
                  <>
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">Wallet Name</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: selectedCustomWallet.color }}
                        />
                        <span className="font-medium">{selectedCustomWallet.name}</span>
                      </div>
                    </div>
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-medium">
                        {currencySymbol} {formatCurrency(selectedCustomWallet.currentBalance)}
                      </span>
                    </div>
                  </>
                )}

                {selectedUserWallet && (
                  <>
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">User</span>
                      <div className="text-right">
                        <div className="font-medium">{selectedUserWallet.userName}</div>
                        <div className="text-sm text-muted-foreground">{selectedUserWallet.userEmail}</div>
                      </div>
                    </div>
                    <div className="flex justify-between py-3 border-b">
                      <span className="text-muted-foreground">Current Balance</span>
                      <span className="font-medium">
                        {currencySymbol} {formatCurrency(selectedUserWallet.currentBalance)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex justify-between py-3 border-b">
                  <span className="text-muted-foreground">Top-Up Amount</span>
                  <span className="font-medium text-green-600">
                    +{currencySymbol} {formatCurrency(formData.amount)}
                  </span>
                </div>

                {formData.reference && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-medium">{formData.reference}</span>
                  </div>
                )}

                {formData.reason && (
                  <div className="flex justify-between py-3 border-b">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="font-medium text-right max-w-xs">{formData.reason}</span>
                  </div>
                )}

                <div className="flex justify-between py-3 bg-muted/50 rounded-lg px-4">
                  <span className="font-semibold">New Balance (After Top-Up)</span>
                  <span className="font-bold text-lg text-primary">
                    {currencySymbol} {formatCurrency((selectedCustomWallet?.currentBalance || selectedUserWallet?.currentBalance || 0) + formData.amount)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  ⚠️ Please confirm the transaction details before proceeding
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  This action will add {currencySymbol} {formatCurrency(formData.amount)} to the selected wallet
                </p>
              </div>

              <div className="space-y-4">
                <div className="text-center py-6">
                  <div className="text-5xl mb-4">💰</div>
                  <div className="text-2xl font-bold mb-2">
                    {currencySymbol} {formatCurrency(formData.amount)}
                  </div>
                  <div className="text-muted-foreground">
                    will be added to {walletType === 'custom' ? selectedCustomWallet?.name : selectedUserWallet?.userName}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current Balance:</span>
                    <span className="font-medium">
                      {currencySymbol} {formatCurrency(selectedCustomWallet?.currentBalance || selectedUserWallet?.currentBalance || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Top-Up Amount:</span>
                    <span className="font-medium">+{currencySymbol} {formatCurrency(formData.amount)}</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between font-bold">
                    <span>New Balance:</span>
                    <span className="text-primary">
                      {currencySymbol} {formatCurrency((selectedCustomWallet?.currentBalance || selectedUserWallet?.currentBalance || 0) + formData.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 border rounded-lg p-4 bg-muted/30">
                <Checkbox
                  id="confirm"
                  checked={confirmChecked}
                  onCheckedChange={(checked) => setConfirmChecked(checked as boolean)}
                />
                <label
                  htmlFor="confirm"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  I confirm that all the information above is correct and I want to proceed with this transaction
                </label>
              </div>

              <div className="flex justify-between gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleBack} disabled={topUpMutation.isPending}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={topUpMutation.isPending || !confirmChecked}>
                  {topUpMutation.isPending ? 'Processing...' : (
                    <>
                      Confirm & Process
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {currentStep === 4 && topUpResult && (
            <div className="space-y-6">
              <div className="text-center py-8">
                {topUpResult.success ? (
                  <>
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Top-Up Successful!</h3>
                    <p className="text-muted-foreground">{topUpResult.message}</p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                      <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">Top-Up Failed</h3>
                    <p className="text-muted-foreground">{topUpResult.message}</p>
                  </>
                )}
              </div>

              {topUpResult.success && topUpResult.data && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Amount Added:</span>
                    <span className="font-medium text-green-600">
                      +{currencySymbol} {formatCurrency(topUpResult.data.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Previous Balance:</span>
                    <span className="font-medium">
                      {currencySymbol} {formatCurrency(topUpResult.data.balanceBefore)}
                    </span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between font-bold">
                    <span>New Balance:</span>
                    <span className="text-primary">
                      {currencySymbol} {formatCurrency(topUpResult.data.balanceAfter)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2 pt-4">
                <Button type="button" onClick={handleStartNew}>
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  New Top-Up
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
