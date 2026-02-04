import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
        <CardContent className="p-3 space-y-3">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Activity History</h3>
              <p className="text-xs text-muted-foreground">
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

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-3 w-[100px]">Type</TableHead>
                  <TableHead className="h-10 px-3">Description</TableHead>
                  <TableHead className="h-10 px-3 w-[150px]">Performed By</TableHead>
                  <TableHead className="h-10 px-3 w-[150px]">Performed For</TableHead>
                  <TableHead className="h-10 px-3 w-[180px]">Profile</TableHead>
                  <TableHead className="h-10 px-3 w-[180px]">Expiration</TableHead>
                  <TableHead className="h-10 px-3 w-[150px]">Details</TableHead>
                  <TableHead className="h-10 px-3 w-[180px]">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No activity history found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEvents.map((event, index) => (
                    <TableRow key={`${event.eventType}-${event.id}-${index}`}>
                      {/* Type */}
                      <TableCell className="h-10 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${getEventColor(event.eventType)}`}>
                            {getEventIcon(event.eventType)}
                          </div>
                          <Badge variant="outline" className={`${getEventColor(event.eventType)} text-xs py-0`}>
                            {getEventLabel(event.eventType)}
                          </Badge>
                        </div>
                        {event.isOnBehalf && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 text-xs py-0 mt-1">
                            <UserCheck className="h-3 w-3 mr-1" />
                            On Behalf
                          </Badge>
                        )}
                      </TableCell>
                      
                      {/* Description */}
                      <TableCell className="h-10 px-3">
                        <p className="text-sm font-medium">{event.description}</p>
                      </TableCell>
                      
                      {/* Performed By */}
                      <TableCell className="h-10 px-3">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>{event.performedBy || '-'}</span>
                        </div>
                      </TableCell>
                      
                      {/* Performed For */}
                      <TableCell className="h-10 px-3">
                        {event.isOnBehalf && event.performedFor ? (
                          <div className="flex items-center gap-1 text-sm">
                            <UserCheck className="h-3 w-3 text-muted-foreground" />
                            <span>{event.performedFor}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      
                      {/* Profile */}
                      <TableCell className="h-10 px-3">
                        {event.details && event.eventType === 'activation' ? (
                          <div className="text-xs space-y-0.5">
                            {event.details.billingProfile && (
                              <div className="truncate">
                                <span className="text-muted-foreground">Billing:</span> {event.details.billingProfile}
                              </div>
                            )}
                            {event.details.radiusProfile && (
                              <div className="truncate">
                                <span className="text-muted-foreground">Radius:</span> {event.details.radiusProfile}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      
                      {/* Expiration */}
                      <TableCell className="h-10 px-3">
                        {event.details && event.eventType === 'activation' ? (
                          <div className="text-xs space-y-0.5">
                            {event.details.previousExpire && (
                              <div>
                                <span className="text-muted-foreground">Previous:</span> {new Date(event.details.previousExpire).toLocaleDateString()}
                              </div>
                            )}
                            {event.details.currentExpire && (
                              <div>
                                <span className="text-muted-foreground">New:</span> {new Date(event.details.currentExpire).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      
                      {/* Details */}
                      <TableCell className="h-10 px-3">
                        {event.details ? (
                          <div className="text-xs space-y-0.5">
                            {event.eventType === 'activation' && (
                              <>
                                {event.details.amount && (
                                  <div>
                                    <span className="text-muted-foreground">Amount:</span> ${event.details.amount}
                                  </div>
                                )}
                                {event.details.type && (
                                  <div>
                                    <span className="text-muted-foreground">Type:</span> {event.details.type}
                                  </div>
                                )}
                              </>
                            )}
                            {event.eventType === 'wallet_transaction' && (
                              <>
                                <div>
                                  <span className="text-muted-foreground">Amount:</span> {event.details.amount} {event.details.currency}
                                </div>
                                {event.details.transactionType && (
                                  <div className="truncate">
                                    <span className="text-muted-foreground">Type:</span> {event.details.transactionType}
                                  </div>
                                )}
                                {event.details.balanceBefore !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Before:</span> {event.details.balanceBefore}
                                  </div>
                                )}
                                {event.details.balanceAfter !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">After:</span> {event.details.balanceAfter}
                                  </div>
                                )}
                                {event.details.description && (
                                  <div className="truncate">
                                    <span className="text-muted-foreground">Desc:</span> {event.details.description}
                                  </div>
                                )}
                                {event.details.reference && (
                                  <div className="truncate">
                                    <span className="text-muted-foreground">Ref:</span> {event.details.reference}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      
                      {/* Timestamp */}
                      <TableCell className="h-10 px-3">
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium">
                            {formatDistance(new Date(event.timestamp), new Date(), { addSuffix: true })}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredEvents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
              <div className="flex items-center gap-3">
                <div className="text-xs text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length} events
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Events per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setCurrentPage(1)
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Page</span>
                  <span className="text-xs font-medium">{currentPage}</span>
                  <span className="text-xs text-muted-foreground">of</span>
                  <span className="text-xs font-medium">{totalPages}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
