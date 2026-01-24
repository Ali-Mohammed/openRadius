import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface UserCashback {
  id: number
  userId: number
  billingProfileId: number
  amount: number
  billingProfile?: {
    id: number
    name: string
    price: number
  }
}

interface UserCashbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userName?: string
}

export function UserCashbackDialog({ open, onOpenChange, userId, userName }: UserCashbackDialogProps) {
  const [cashbacks, setCashbacks] = useState<UserCashback[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && userId) {
      fetchUserCashbacks()
    }
  }, [open, userId])

  const fetchUserCashbacks = async () => {
    setLoading(true)
    try {
      const response = await apiClient.get(`/api/UserCashback?userId=${userId}`)
      setCashbacks(response.data || [])
    } catch (error) {
      console.error('Failed to fetch user cashbacks:', error)
      setCashbacks([])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            User Cashback Details
            {userName && (
              <Badge variant="outline" className="ml-2">
                {userName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cashbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No cashback configured for this user
            </div>
          ) : (
            <div className="space-y-3">
              {cashbacks.map((cashback) => (
                <div
                  key={cashback.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {cashback.billingProfile?.name || `Profile #${cashback.billingProfileId}`}
                    </div>
                    {cashback.billingProfile?.price && (
                      <div className="text-sm text-muted-foreground">
                        Profile Price: IQD {formatCurrency(cashback.billingProfile.price)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      IQD {formatCurrency(cashback.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">Cashback Amount</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
