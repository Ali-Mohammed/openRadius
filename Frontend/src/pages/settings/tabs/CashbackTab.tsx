import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Coins, Save } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cashbackSettingsApi, type CashbackSettings } from '@/api/cashbackSettingsApi'
import { formatApiError } from '@/utils/errorHandler'

export default function CashbackTab() {
  const queryClient = useQueryClient()
  const [cashbackTransactionType, setCashbackTransactionType] = useState('Instant')
  const [collectionSchedule, setCollectionSchedule] = useState('AnyTime')
  const [minimumCollectionAmount, setMinimumCollectionAmount] = useState(0)
  const [requiresApproval, setRequiresApproval] = useState(false)

  const { data: cashbackSettings, isLoading: isCashbackLoading } = useQuery({
    queryKey: ['cashback-settings'],
    queryFn: cashbackSettingsApi.getSettings,
  })

  useEffect(() => {
    if (cashbackSettings) {
      setCashbackTransactionType(cashbackSettings.transactionType || 'Instant')
      setCollectionSchedule(cashbackSettings.collectionSchedule || 'AnyTime')
      setMinimumCollectionAmount(cashbackSettings.minimumCollectionAmount || 0)
      setRequiresApproval(cashbackSettings.requiresApprovalToCollect || false)
    }
  }, [cashbackSettings])

  const updateCashbackMutation = useMutation({
    mutationFn: (data: Partial<CashbackSettings>) => cashbackSettingsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-settings'] })
      toast.success('Cashback settings updated successfully')
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const handleSaveCashback = () => {
    updateCashbackMutation.mutate({
      transactionType: cashbackTransactionType,
      collectionSchedule,
      minimumCollectionAmount,
      requiresApprovalToCollect: requiresApproval,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Cashback Transaction Settings
        </CardTitle>
        <CardDescription>Configure cashback transaction type and collection settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Transaction Type */}
        <div className="space-y-4">
          <Label>Transaction Type</Label>
          <RadioGroup value={cashbackTransactionType} onValueChange={setCashbackTransactionType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Instant" id="instant" />
              <Label htmlFor="instant" className="cursor-pointer font-normal">
                <div>
                  <div className="font-medium">Instant</div>
                  <div className="text-sm text-muted-foreground">Cashback is credited immediately to user wallet</div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Collected" id="collected" />
              <Label htmlFor="collected" className="cursor-pointer font-normal">
                <div>
                  <div className="font-medium">Collected</div>
                  <div className="text-sm text-muted-foreground">Cashback must be collected by user based on schedule</div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Collected Settings (shown only when Collected is selected) */}
        {cashbackTransactionType === 'Collected' && (
          <div className="space-y-6 pl-6 border-l-2 border-muted">
            {/* Collection Schedule */}
            <div className="space-y-3">
              <Label>Collection Schedule</Label>
              <RadioGroup value={collectionSchedule} onValueChange={setCollectionSchedule}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AnyTime" id="anytime" />
                  <Label htmlFor="anytime" className="cursor-pointer font-normal">Any time</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EndOfWeek" id="endofweek" />
                  <Label htmlFor="endofweek" className="cursor-pointer font-normal">End of the week</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EndOfMonth" id="endofmonth" />
                  <Label htmlFor="endofmonth" className="cursor-pointer font-normal">End of the month</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Minimum Collection Amount */}
            <div className="space-y-2">
              <Label htmlFor="min-amount">Minimum Collection Amount</Label>
              <Input
                id="min-amount"
                type="number"
                min="0"
                step="0.01"
                value={minimumCollectionAmount}
                onChange={(e) => setMinimumCollectionAmount(parseFloat(e.target.value) || 0)}
                className="max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                Users can only collect cashback when their balance reaches this amount
              </p>
            </div>

            {/* Requires Approval */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requires-approval"
                checked={requiresApproval}
                onCheckedChange={(checked) => setRequiresApproval(checked as boolean)}
              />
              <Label htmlFor="requires-approval" className="cursor-pointer font-normal">
                Require approval before users can collect cashback
              </Label>
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button onClick={handleSaveCashback} disabled={updateCashbackMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateCashbackMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
