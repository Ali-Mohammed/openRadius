import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Activity, 
  Zap, 
  Lock, 
  Edit, 
  Wallet, 
  ToggleLeft,
  Plus,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  UserCheck
} from 'lucide-react'
import { userHistoryApi, type UserHistoryEvent } from '@/api/userHistoryApi'
import { radiusActivationApi } from '@/api/radiusActivationApi'
import walletHistoryApi from '@/api/walletHistory'
import { radiusUserApi } from '@/api/radiusUserApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatDistance } from 'date-fns'

export function HistoryTab() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { currentWorkspaceId } = useWorkspace()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [eventFilter, setEventFilter] = useState<string>('all')

  // Check if id is a UUID (has dashes) or numeric ID
  const isUuid = id?.includes('-')

  // Fetch user data to get numeric ID
  const { data: user } = useQuery({
    queryKey: ['radius-user', currentWorkspaceId, id],
    queryFn: async () => {
      if (!id) throw new Error('Missing user ID')
      return isUuid 
        ? radiusUserApi.getByUuid(id)
        : radiusUserApi.getById(Number(id))
    },
    enabled: !!id,
  })

  // Fetch activations
  const { data: activationsData, isLoading: isLoadingActivations } = useQuery({
    queryKey: ['radius-activations', currentWorkspaceId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return radiusActivationApi.getUserActivations(user.id, 100)
    },
    enabled: !!user?.id,
  })

  // Fetch wallet history
  const { data: walletHistoryData, isLoading: isLoadingWallet } = useQuery({
    queryKey: ['wallet-history', currentWorkspaceId, user?.id],
    queryFn: async () => {
      if (!user?.id) return { data: [], totalCount: 0 }
      return walletHistoryApi.getByUser(user.id, 1, 100)
    },
    enabled: !!user?.id,
  })

  // Fetch user change history
  const { data: userHistoryData, isLoading: isLoadingUserHistory } = useQuery({
    queryKey: ['user-history', currentWorkspaceId, user?.uuid, eventFilter],
    queryFn: async () => {
      if (!user?.uuid) return { data: [], totalCount: 0 }
      return radiusUserApi.getUserHistory(user.uuid, 1, 100, eventFilter === 'all' ? undefined : eventFilter)
    },
    enabled: !!user?.uuid,
  })

  // Combine all events into a unified timeline
  const allEvents: UserHistoryEvent[] = []

  // Add activation events
  if (activationsData) {
    activationsData.forEach((activation: any) => {
      allEvents.push({
        id: activation.id,
        eventType: 'activation',
        timestamp: activation.createdAt,
        performedBy: activation.actionByUsername || 'System',
        performedFor: activation.actionForUsername || activation.radiusUsername || '',
        isOnBehalf: activation.isActionBehalf,
        description: `Activated with ${activation.billingProfileName || 'profile'}`,
        details: {
          billingProfile: activation.billingProfileName,
          radiusProfile: activation.radiusProfileName,
          previousExpire: activation.previousExpireDate,
          currentExpire: activation.currentExpireDate,
          amount: activation.amount,
          type: activation.type,
          status: activation.status,
        },
      })
    })
  }

  // Add wallet transactions
  if (walletHistoryData?.data) {
    walletHistoryData.data.forEach((transaction: any) => {
      allEvents.push({
        id: transaction.id,
        eventType: 'wallet_transaction',
        timestamp: transaction.createdAt,
        performedBy: transaction.userName || transaction.userEmail || 'System',
        performedFor: '',
        isOnBehalf: false,
        description: `${transaction.transactionType} - ${transaction.amount} ${transaction.currency || 'USD'}`,
        details: {
          amount: transaction.amount,
          currency: transaction.currency || 'USD',
          balanceBefore: transaction.balanceBefore,
          balanceAfter: transaction.balanceAfter,
          transactionType: transaction.transactionType,
          description: transaction.description,
          reference: transaction.reference,
        },
      })
    })
  }

  // Add user change history
  if (userHistoryData?.data) {
    userHistoryData.data.forEach((historyEvent: any) => {
      allEvents.push({
        id: historyEvent.id,
        eventType: historyEvent.eventType,
        timestamp: historyEvent.performedAt,
        performedBy: historyEvent.performedBy || 'System',
        performedFor: user?.username || '',
        isOnBehalf: false,
        description: historyEvent.description,
        details: {
          action: historyEvent.action,
          changes: historyEvent.changes,
          oldValue: historyEvent.oldValue,
          newValue: historyEvent.newValue,
          ipAddress: historyEvent.ipAddress,
          userAgent: historyEvent.userAgent,
        },
      })
    })
  }

  // Sort by timestamp
  const sortedEvents = allEvents.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  // Filter events
  const filteredEvents = eventFilter === 'all' 
    ? sortedEvents 
    : sortedEvents.filter(e => e.eventType === eventFilter)

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / pageSize)
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'activation':
        return <Zap className="h-4 w-4" />
      case 'username_change':
        return <UserCheck className="h-4 w-4" />
      case 'password_change':
        return <Lock className="h-4 w-4" />
      case 'info_update':
        return <Edit className="h-4 w-4" />
      case 'wallet_transaction':
        return <Wallet className="h-4 w-4" />
      case 'status_change':
        return <ToggleLeft className="h-4 w-4" />
      case 'creation':
        return <Plus className="h-4 w-4" />
      case 'deletion':
        return <Trash2 className="h-4 w-4" />
      case 'custom_attribute':
        return <Settings className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'activation':
        return 'bg-green-500/10 text-green-700 border-green-500/20'
      case 'username_change':
        return 'bg-cyan-500/10 text-cyan-700 border-cyan-500/20'
      case 'password_change':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20'
      case 'info_update':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20'
      case 'wallet_transaction':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/20'
      case 'status_change':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20'
      case 'creation':
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
      case 'deletion':
        return 'bg-red-500/10 text-red-700 border-red-500/20'
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20'
    }
  }

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'activation':
        return 'Activation'
      case 'username_change':
        return 'Username Change'
      case 'password_change':
        return 'Password Change'
      case 'info_update':
        return 'Info Update'
      case 'wallet_transaction':
        return 'Wallet Transaction'
      case 'status_change':
        return 'Status Change'
      case 'creation':
        return 'User Created'
      case 'deletion':
        return 'User Deleted'
      case 'custom_attribute':
        return 'Custom Attribute'
      default:
        return 'Activity'
    }
  }

  if (isLoadingActivations || isLoadingWallet || isLoadingUserHistory) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Activity History</h3>
              <p className="text-sm text-muted-foreground">
                Complete timeline of user activities and changes
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="activation">Activations</SelectItem>
                  <SelectItem value="wallet_transaction">Wallet Transactions</SelectItem>
                  <SelectItem value="password_change">Password Changes</SelectItem>
                  <SelectItem value="info_update">Info Updates</SelectItem>
                  <SelectItem value="status_change">Status Changes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-4">
            {paginatedEvents.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No activity history found</p>
              </div>
            ) : (
              <>
                {paginatedEvents.map((event, index) => (
                  <div
                    key={`${event.eventType}-${event.id}-${index}`}
                    className="relative flex gap-4 pb-4 border-b last:border-0"
                  >
                    {/* Timeline indicator */}
                    <div className="flex flex-col items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border ${getEventColor(event.eventType)}`}>
                        {getEventIcon(event.eventType)}
                      </div>
                      {index < paginatedEvents.length - 1 && (
                        <div className="w-px h-full bg-border mt-2" />
                      )}
                    </div>

                    {/* Event content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getEventColor(event.eventType)}>
                            {getEventLabel(event.eventType)}
                          </Badge>
                          {event.isOnBehalf && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20">
                              <UserCheck className="h-3 w-3 mr-1" />
                              On Behalf
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}
                        </div>
                      </div>

                      <p className="font-medium text-sm mb-1">{event.description}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        {event.performedBy && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>By: {event.performedBy}</span>
                          </div>
                        )}
                        {event.isOnBehalf && event.performedFor && (
                          <div className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />
                            <span>For: {event.performedFor}</span>
                          </div>
                        )}
                      </div>

                      {/* Event details */}
                      {event.details && (
                        <div className="mt-2 p-3 bg-muted/30 rounded-md">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {event.eventType === 'activation' && (
                              <>
                                {event.details.billingProfile && (
                                  <div>
                                    <span className="text-muted-foreground">Billing Profile:</span>
                                    <span className="ml-2 font-medium">{event.details.billingProfile}</span>
                                  </div>
                                )}
                                {event.details.radiusProfile && (
                                  <div>
                                    <span className="text-muted-foreground">Radius Profile:</span>
                                    <span className="ml-2 font-medium">{event.details.radiusProfile}</span>
                                  </div>
                                )}
                                {event.details.amount && (
                                  <div>
                                    <span className="text-muted-foreground">Amount:</span>
                                    <span className="ml-2 font-medium">${event.details.amount}</span>
                                  </div>
                                )}
                                {event.details.previousExpire && (
                                  <div>
                                    <span className="text-muted-foreground">Previous Expire:</span>
                                    <span className="ml-2 font-medium">
                                      {new Date(event.details.previousExpire).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {event.details.currentExpire && (
                                  <div>
                                    <span className="text-muted-foreground">New Expire:</span>
                                    <span className="ml-2 font-medium">
                                      {new Date(event.details.currentExpire).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {event.details.type && (
                                  <div>
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="ml-2 font-medium">{event.details.type}</span>
                                  </div>
                                )}
                              </>
                            )}
                            {event.eventType === 'wallet_transaction' && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Amount:</span>
                                  <span className="ml-2 font-medium">
                                    {event.details.amount} {event.details.currency}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Type:</span>
                                  <span className="ml-2 font-medium">{event.details.transactionType}</span>
                                </div>
                                {event.details.balanceBefore !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Balance Before:</span>
                                    <span className="ml-2 font-medium">{event.details.balanceBefore}</span>
                                  </div>
                                )}
                                {event.details.balanceAfter !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Balance After:</span>
                                    <span className="ml-2 font-medium">{event.details.balanceAfter}</span>
                                  </div>
                                )}
                                {event.details.description && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Description:</span>
                                    <span className="ml-2 font-medium">{event.details.description}</span>
                                  </div>
                                )}
                                {event.details.reference && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Reference:</span>
                                    <span className="ml-2 font-medium">{event.details.reference}</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mt-2">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length} events
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
