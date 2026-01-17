import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Activity,
  Eye,
  Trash2,
  Calendar,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { radiusActivationApi, type RadiusActivation } from '@/api/radiusActivationApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaceApi } from '@/lib/api'

export default function RadiusActivations() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const { i18n } = useTranslation()

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterApiStatus, setFilterApiStatus] = useState<string>('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedActivation, setSelectedActivation] = useState<RadiusActivation | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع ' : 'IQD '
      case 'USD':
      default:
        return '$'
    }
  }

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: activationsData, isLoading, isFetching } = useQuery({
    queryKey: [
      'radius-activations',
      currentWorkspaceId,
      currentPage,
      pageSize,
      searchQuery,
      filterType,
      filterStatus,
      filterApiStatus,
      startDate,
      endDate,
      sortField,
      sortDirection
    ],
    queryFn: () =>
      radiusActivationApi.getAll({
        page: currentPage,
        pageSize,
        search: searchQuery || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        apiStatus: filterApiStatus || undefined,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        sortField,
        sortDirection
      }),
    enabled: !!currentWorkspaceId,
  })

  const { data: types } = useQuery({
    queryKey: ['activation-types'],
    queryFn: () => radiusActivationApi.getTypes(),
  })

  const { data: statuses } = useQuery({
    queryKey: ['activation-statuses'],
    queryFn: () => radiusActivationApi.getStatuses(),
  })

  const { data: apiStatuses } = useQuery({
    queryKey: ['activation-api-statuses'],
    queryFn: () => radiusActivationApi.getApiStatuses(),
  })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: number) => radiusActivationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success('Activation deleted successfully')
      setDeleteId(null)
    },
    onError: () => {
      toast.error('Failed to delete activation')
    }
  })

  const activations = activationsData?.data || []
  const totalPages = activationsData?.totalPages || 1
  const totalCount = activationsData?.totalCount || 0

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'processing':
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Activity className="h-3 w-3 mr-1" />Processing</Badge>
      case 'cancelled':
        return <Badge variant="outline"><X className="h-3 w-3 mr-1" />Cancelled</Badge>
      case 'rolled_back':
        return <Badge variant="outline" className="border-orange-500 text-orange-500"><AlertCircle className="h-3 w-3 mr-1" />Rolled Back</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getApiStatusBadge = (apiStatus: string | undefined) => {
    if (!apiStatus) return <span className="text-muted-foreground">-</span>
    switch (apiStatus) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'timeout':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Timeout</Badge>
      case 'not_called':
        return <Badge variant="secondary">Not Called</Badge>
      default:
        return <Badge variant="outline">{apiStatus}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'new_activation':
        return <Badge variant="default">New Activation</Badge>
      case 'renew':
        return <Badge variant="outline" className="border-green-500 text-green-500">Renew</Badge>
      case 'change_profile':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Change Profile</Badge>
      case 'upgrade':
        return <Badge variant="outline" className="border-purple-500 text-purple-500">Upgrade</Badge>
      case 'downgrade':
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Downgrade</Badge>
      case 'extension':
        return <Badge variant="outline" className="border-cyan-500 text-cyan-500">Extension</Badge>
      case 'reactivation':
        return <Badge variant="outline" className="border-emerald-500 text-emerald-500">Reactivation</Badge>
      case 'suspension':
        return <Badge variant="destructive">Suspension</Badge>
      case 'cancellation':
        return <Badge variant="destructive">Cancellation</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSearchInput('')
    setFilterType('')
    setFilterStatus('')
    setFilterApiStatus('')
    setStartDate(undefined)
    setEndDate(undefined)
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || filterType || filterStatus || filterApiStatus || startDate || endDate

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activations</h1>
          <p className="text-sm text-muted-foreground">
            Track all user activations, renewals, and profile changes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search activations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-activations'] })}
              variant="outline"
              size="icon"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Filters" className="relative">
                  <Filter className="h-4 w-4" />
                  {hasFilters && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                    {hasFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Types</SelectItem>
                        {types?.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Statuses</SelectItem>
                        {statuses?.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>API Status</Label>
                    <Select value={filterApiStatus} onValueChange={(v) => { setFilterApiStatus(v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All API Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All API Statuses</SelectItem>
                        {apiStatuses?.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="h-4 w-4 mr-2" />
                          {startDate ? format(startDate, 'PP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => { setStartDate(date); setCurrentPage(1) }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <Calendar className="h-4 w-4 mr-2" />
                          {endDate ? format(endDate, 'PP') : 'Pick a date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => { setEndDate(date); setCurrentPage(1) }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('createdAt')}>
                <div className="flex items-center">Date {getSortIcon('createdAt')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('radiusUsername')}>
                <div className="flex items-center">User {getSortIcon('radiusUsername')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('type')}>
                <div className="flex items-center">Type {getSortIcon('type')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 font-semibold">Profile</TableHead>
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('amount')}>
                <div className="flex items-center">Amount {getSortIcon('amount')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 font-semibold">Expiration</TableHead>
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('status')}>
                <div className="flex items-center">Status {getSortIcon('status')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 cursor-pointer font-semibold" onClick={() => handleSort('apiStatus')}>
                <div className="flex items-center">API {getSortIcon('apiStatus')}</div>
              </TableHead>
              <TableHead className="h-12 px-4 font-semibold">Action By</TableHead>
              <TableHead className="h-12 px-4 text-right font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j} className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : activations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No activations found</p>
                </TableCell>
              </TableRow>
            ) : (
              activations.map((activation) => (
                <TableRow key={activation.id}>
                  <TableCell className="h-12 px-4 whitespace-nowrap">
                    {format(new Date(activation.createdAt), 'PP p')}
                  </TableCell>
                  <TableCell className="h-12 px-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{activation.radiusUsername || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="h-12 px-4">{getTypeBadge(activation.type)}</TableCell>
                  <TableCell className="h-12 px-4">
                    <div className="text-sm">
                      {activation.radiusProfileName && (
                        <div>{activation.radiusProfileName}</div>
                      )}
                      {activation.billingProfileName && (
                        <div className="text-muted-foreground text-xs">{activation.billingProfileName}</div>
                      )}
                      {!activation.radiusProfileName && !activation.billingProfileName && '-'}
                    </div>
                  </TableCell>
                  <TableCell className="h-12 px-4">
                    {activation.amount ? (
                      <span className="font-medium">{currencySymbol}{activation.amount.toLocaleString()}</span>
                    ) : '-'}
                  </TableCell>
                  <TableCell className="h-12 px-4">
                    <div className="text-sm">
                      {activation.currentExpireDate ? (
                        <div>{format(new Date(activation.currentExpireDate), 'PP')}</div>
                      ) : '-'}
                      {activation.previousExpireDate && (
                        <div className="text-xs text-muted-foreground line-through">
                          {format(new Date(activation.previousExpireDate), 'PP')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="h-12 px-4">{getStatusBadge(activation.status)}</TableCell>
                  <TableCell className="h-12 px-4">{getApiStatusBadge(activation.apiStatus)}</TableCell>
                  <TableCell className="h-12 px-4">
                    <div className="text-sm">
                      {activation.actionByUsername || '-'}
                      {activation.isActionBehalf && (
                        <Badge variant="outline" className="ml-1 text-xs">Behalf</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="h-12 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedActivation(activation)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(activation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {totalCount > 0 ? (
              <>Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}</>
            ) : (
              <>No results</>
            )}
          </span>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-4 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedActivation} onOpenChange={() => setSelectedActivation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activation Details</DialogTitle>
            <DialogDescription>
              ID: {selectedActivation?.id} | {selectedActivation?.createdAt && format(new Date(selectedActivation.createdAt), 'PPpp')}
            </DialogDescription>
          </DialogHeader>
          {selectedActivation && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="font-medium">{selectedActivation.radiusUsername}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p>{getTypeBadge(selectedActivation.type)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p>{getStatusBadge(selectedActivation.status)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">API Status</Label>
                <p>{getApiStatusBadge(selectedActivation.apiStatus)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">RADIUS Profile</Label>
                <p className="font-medium">{selectedActivation.radiusProfileName || '-'}</p>
                {selectedActivation.previousRadiusProfileName && (
                  <p className="text-sm text-muted-foreground">From: {selectedActivation.previousRadiusProfileName}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Billing Profile</Label>
                <p className="font-medium">{selectedActivation.billingProfileName || '-'}</p>
                {selectedActivation.previousBillingProfileName && (
                  <p className="text-sm text-muted-foreground">From: {selectedActivation.previousBillingProfileName}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="font-medium">
                  {selectedActivation.amount ? `${currencySymbol}${selectedActivation.amount.toLocaleString()}` : '-'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Payment Method</Label>
                <p>{selectedActivation.paymentMethod || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Previous Expiration</Label>
                <p>{selectedActivation.previousExpireDate ? format(new Date(selectedActivation.previousExpireDate), 'PPp') : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Current Expiration</Label>
                <p className="font-medium">{selectedActivation.currentExpireDate ? format(new Date(selectedActivation.currentExpireDate), 'PPp') : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Previous Balance</Label>
                <p>{selectedActivation.previousBalance !== undefined ? `${currencySymbol}${selectedActivation.previousBalance.toLocaleString()}` : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">New Balance</Label>
                <p className="font-medium">{selectedActivation.newBalance !== undefined ? `${currencySymbol}${selectedActivation.newBalance.toLocaleString()}` : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Action By</Label>
                <p>{selectedActivation.actionByUsername || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Source</Label>
                <p>{selectedActivation.source || '-'}</p>
              </div>
              {selectedActivation.apiStatusMessage && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">API Message</Label>
                  <p className="text-sm bg-muted p-2 rounded">{selectedActivation.apiStatusMessage}</p>
                </div>
              )}
              {selectedActivation.notes && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="text-sm">{selectedActivation.notes}</p>
                </div>
              )}
              {selectedActivation.externalReferenceId && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">External Reference</Label>
                  <p className="font-mono text-sm">{selectedActivation.externalReferenceId}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activation record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
