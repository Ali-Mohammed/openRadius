import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Info, User, Calendar, DollarSign, CreditCard, Tag, Clock, CheckCircle, XCircle, AlertCircle, Receipt } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { radiusActivationApi } from '@/api/radiusActivationApi'
import { formatApiError } from '@/utils/errorHandler'

interface ActivationDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activationId: number
}

export function ActivationDetailsDialog({
  open,
  onOpenChange,
  activationId,
}: ActivationDetailsDialogProps) {
  // Fetch activation details
  const { data: activation, isLoading, error } = useQuery({
    queryKey: ['activation-details', activationId],
    queryFn: () => radiusActivationApi.getById(activationId),
    enabled: open && !!activationId,
  })

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getApiStatusIcon = (apiStatus?: string) => {
    switch (apiStatus?.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Activation Details #{activationId}
          </DialogTitle>
          <DialogDescription>
            Detailed information about the billing activation
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              {formatApiError(error) || 'Failed to load activation details'}
            </div>
          ) : activation ? (
            <div className="space-y-6 pb-4">
              {/* Status and Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  <Badge className={getStatusColor(activation.status)}>
                    {activation.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Type</div>
                  <Badge variant="outline">{activation.type}</Badge>
                </div>
              </div>

              {/* API Status */}
              {activation.apiStatus && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    {getApiStatusIcon(activation.apiStatus)}
                    <span className="font-medium">API Status</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div><strong>Status:</strong> {activation.apiStatus}</div>
                    {activation.apiStatusCode && (
                      <div><strong>Status Code:</strong> {activation.apiStatusCode}</div>
                    )}
                    {activation.apiStatusMessage && (
                      <div><strong>Message:</strong> {activation.apiStatusMessage}</div>
                    )}
                    {activation.externalReferenceId && (
                      <div><strong>Reference ID:</strong> {activation.externalReferenceId}</div>
                    )}
                  </div>
                </div>
              )}

              {/* User Information */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4" />
                  <span className="font-medium">User Information</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">RADIUS Username</div>
                    <div className="font-medium">{activation.radiusUsername || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">RADIUS User ID</div>
                    <div className="font-medium">{activation.radiusUserId}</div>
                  </div>
                  {activation.isActionBehalf && (
                    <>
                      <div>
                        <div className="text-muted-foreground">Action By</div>
                        <div className="font-medium">{activation.actionByUsername || `ID: ${activation.actionById}`}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Action For</div>
                        <div className="font-medium">{activation.actionForUsername || `ID: ${activation.actionForId}`}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Profile Information */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4" />
                  <span className="font-medium">Profile Information</span>
                </div>
                <div className="space-y-3 text-sm">
                  {/* RADIUS Profile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-muted-foreground">Previous RADIUS Profile</div>
                      <div className="font-medium">{activation.previousRadiusProfileName || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Current RADIUS Profile</div>
                      <div className="font-medium">{activation.radiusProfileName || 'N/A'}</div>
                    </div>
                  </div>
                  {/* Billing Profile */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-muted-foreground">Previous Billing Profile</div>
                      <div className="font-medium">{activation.previousBillingProfileName || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Current Billing Profile</div>
                      <div className="font-medium">{activation.billingProfileName || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expiration Dates */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Expiration Dates</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {activation.previousExpireDate && (
                    <div>
                      <div className="text-muted-foreground">Previous</div>
                      <div className="font-medium">
                        {format(new Date(activation.previousExpireDate), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  )}
                  {activation.currentExpireDate && (
                    <div>
                      <div className="text-muted-foreground">Current</div>
                      <div className="font-medium">
                        {format(new Date(activation.currentExpireDate), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  )}
                  {activation.nextExpireDate && (
                    <div>
                      <div className="text-muted-foreground">Next</div>
                      <div className="font-medium">
                        {format(new Date(activation.nextExpireDate), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Information */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-medium">Financial Information</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {activation.amount !== null && activation.amount !== undefined && (
                    <div>
                      <div className="text-muted-foreground">Amount</div>
                      <div className="font-medium">${activation.amount.toFixed(2)}</div>
                    </div>
                  )}
                  {activation.previousBalance !== null && activation.previousBalance !== undefined && (
                    <div>
                      <div className="text-muted-foreground">Previous Balance</div>
                      <div className="font-medium">${activation.previousBalance.toFixed(2)}</div>
                    </div>
                  )}
                  {activation.newBalance !== null && activation.newBalance !== undefined && (
                    <div>
                      <div className="text-muted-foreground">New Balance</div>
                      <div className="font-medium">${activation.newBalance.toFixed(2)}</div>
                    </div>
                  )}
                  {activation.paymentMethod && (
                    <div>
                      <div className="text-muted-foreground">Payment Method</div>
                      <div className="font-medium">{activation.paymentMethod}</div>
                    </div>
                  )}
                  {activation.durationDays && (
                    <div>
                      <div className="text-muted-foreground">Duration</div>
                      <div className="font-medium">{activation.durationDays} days</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Details */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4" />
                  <span className="font-medium">Additional Details</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {activation.source && (
                    <div>
                      <div className="text-muted-foreground">Source</div>
                      <div className="font-medium">{activation.source}</div>
                    </div>
                  )}
                  {activation.ipAddress && (
                    <div>
                      <div className="text-muted-foreground">IP Address</div>
                      <div className="font-medium">{activation.ipAddress}</div>
                    </div>
                  )}
                  {activation.transactionId && (
                    <div>
                      <div className="text-muted-foreground">Transaction ID</div>
                      <div className="font-medium">{activation.transactionId}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-muted-foreground">Retry Count</div>
                    <div className="font-medium">{activation.retryCount}</div>
                  </div>
                </div>
                {activation.notes && (
                  <div className="mt-3">
                    <div className="text-muted-foreground mb-1">Notes</div>
                    <div className="p-2 bg-muted rounded text-sm">{activation.notes}</div>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Timestamps</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Created At</div>
                    <div className="font-medium">
                      {format(new Date(activation.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                    </div>
                  </div>
                  {activation.updatedAt && (
                    <div>
                      <div className="text-muted-foreground">Updated At</div>
                      <div className="font-medium">
                        {format(new Date(activation.updatedAt), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </div>
                  )}
                  {activation.processingStartedAt && (
                    <div>
                      <div className="text-muted-foreground">Processing Started</div>
                      <div className="font-medium">
                        {format(new Date(activation.processingStartedAt), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </div>
                  )}
                  {activation.processingCompletedAt && (
                    <div>
                      <div className="text-muted-foreground">Processing Completed</div>
                      <div className="font-medium">
                        {format(new Date(activation.processingCompletedAt), 'MMM dd, yyyy HH:mm:ss')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No activation details found
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
