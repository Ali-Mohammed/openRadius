import { useState, useCallback, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
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
  Calendar,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Settings,
  RotateCcw,
  Columns3,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import { billingActivationsApi, type BillingActivation } from '@/api/billingActivations'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'

export default function BillingActivations() {
  const navigate = useNavigate()
  const { currentWorkspaceId } = useWorkspace()
  
  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    date: true,
    user: true,
    type: true,
    profile: true,
    amount: true,
    cashback: true,
    payment: true,
    status: true,
    actionBy: true,
    actions: true,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    date: 160,
    user: 150,
    type: 120,
    profile: 150,
    amount: 110,
    cashback: 110,
    payment: 120,
    status: 120,
    actionBy: 130,
    actions: 100,
  }

  const DEFAULT_COLUMN_ORDER = [
    'date',
    'user',
    'type',
    'profile',
    'amount',
    'cashback',
    'payment',
    'status',
    'actionBy',
    'actions',
  ]

  // Column state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS)
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedActivation, setSelectedActivation] = useState<BillingActivation | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)

  // Load table preferences
  const { data: preferences } = useQuery({
    queryKey: ['table-preferences', 'billing-activations'],
    queryFn: () => tablePreferenceApi.getPreferences('billing-activations'),
    enabled: !!currentWorkspaceId,
  })

  // Apply preferences when loaded
  useEffect(() => {
    if (preferences) {
      try {
        if (preferences.columnWidths) {
          const parsed = JSON.parse(preferences.columnWidths)
          setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...parsed })
        }
        if (preferences.columnOrder) {
          setColumnOrder(JSON.parse(preferences.columnOrder))
        }
        if (preferences.columnVisibility) {
          setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(preferences.columnVisibility) })
        }
        if (preferences.sortField) setSortField(preferences.sortField)
        if (preferences.sortDirection) setSortDirection(preferences.sortDirection as 'asc' | 'desc')
      } catch (err) {
        console.error('Failed to parse preferences:', err)
      }
    }
  }, [preferences])

  // Auto-save preferences when columns change
  useEffect(() => {
    if (!currentWorkspaceId) return

    const timeoutId = setTimeout(async () => {
      try {
        await tablePreferenceApi.savePreferences({
          tableName: 'billing-activations',
          columnWidths: JSON.stringify(columnWidths),
          columnOrder: JSON.stringify(columnOrder),
          columnVisibility: JSON.stringify(columnVisibility),
          sortField,
          sortDirection,
        })
      } catch (err) {
        console.error('Failed to save preferences:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, currentWorkspaceId])

  // Column resize handler
  const handleResize = useCallback((column: string, startX: number, startWidth: number) => {
    setResizing(column)
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(60, startWidth + diff)
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setTimeout(() => setResizing(null), 100)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Column drag and drop handlers
  const handleDragStart = useCallback((column: string) => {
    setDraggedColumn(column)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, column: string) => {
    e.preventDefault()
    setDragOverColumn(column)
  }, [])

  const handleDrop = useCallback((targetColumn: string) => {
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    const newOrder = [...columnOrder]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumn)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setDragOverColumn(null)
  }, [draggedColumn, columnOrder])

  const handleResetColumns = async () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    setSortField('createdAt')
    setSortDirection('desc')
    setResetColumnsDialogOpen(false)
    
    try {
      await tablePreferenceApi.deletePreferences('billing-activations')
    } catch (err) {
      console.error('Failed to delete preferences:', err)
    }
  }

  // Queries
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      'billing-activations',
      currentPage,
      pageSize,
      searchQuery,
      filterType,
      filterStatus,
      filterPaymentMethod,
      startDate,
      endDate,
      sortField,
      sortDirection,
    ],
    queryFn: () =>
      billingActivationsApi.getBillingActivations({
        page: currentPage,
        pageSize,
        search: searchQuery,
        activationType: filterType || undefined,
        activationStatus: filterStatus || undefined,
        paymentMethod: filterPaymentMethod || undefined,
        startDate: startDate ? startDate.toISOString().split('T')[0] : undefined,
        endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
      }),
  })

  const activations = data?.data || []
  const totalCount = data?.totalCount || 0
  const totalPages = data?.totalPages || 1

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
    setFilterPaymentMethod('')
    setStartDate(undefined)
    setEndDate(undefined)
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || filterType || filterStatus || filterPaymentMethod || startDate || endDate

  // Filter options
  const types = [
    { value: 'new_activation', label: 'New Activation' },
    { value: 'renew', label: 'Renew' },
    { value: 'change_profile', label: 'Change Profile' },
    { value: 'upgrade', label: 'Upgrade' },
    { value: 'downgrade', label: 'Downgrade' },
    { value: 'extension', label: 'Extension' },
    { value: 'reactivation', label: 'Reactivation' },
    { value: 'suspension', label: 'Suspension' },
    { value: 'cancellation', label: 'Cancellation' },
  ]

  const statuses = [
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'rolled_back', label: 'Rolled Back' },
  ]

  const paymentMethods = [
    { value: 'wallet', label: 'Wallet' },
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'mobile_payment', label: 'Mobile Payment' },
  ]

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Activations</h1>
          <p className="text-sm text-muted-foreground">
            View detailed billing and activation history for auditing and reporting
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
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="icon"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Column visibility">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columnOrder.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={columnVisibility[column] !== false}
                  onCheckedChange={(checked) =>
                    setColumnVisibility((prev) => ({ ...prev, [column]: checked }))
                  }
                >
                  {column.charAt(0).toUpperCase() + column.slice(1).replace(/([A-Z])/g, ' $1')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setResetColumnsDialogOpen(true)}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  <Select value={filterType || 'all'} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={filterPaymentMethod || 'all'} onValueChange={(v) => { setFilterPaymentMethod(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Payment Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payment Methods</SelectItem>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
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
          <Button variant="outline" size="icon" title="Export">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columnOrder
                .filter((column) => columnVisibility[column] !== false)
                .map((column) => {
                  const columnConfig: Record<string, { label: string; sortKey?: string }> = {
                    date: { label: 'Date', sortKey: 'createdAt' },
                    user: { label: 'User', sortKey: 'radiusUsername' },
                    type: { label: 'Type', sortKey: 'activationType' },
                    profile: { label: 'Profile' },
                    amount: { label: 'Amount', sortKey: 'amount' },
                    cashback: { label: 'Cashback' },
                    payment: { label: 'Payment' },
                    status: { label: 'Status', sortKey: 'activationStatus' },
                    actionBy: { label: 'Action By' },
                    actions: { label: 'Actions' },
                  }

                  const config = columnConfig[column]
                  const isSortable = !!config.sortKey
                  
                  return (
                    <TableHead
                      key={column}
                      className={`h-12 px-4 font-semibold relative ${column === 'actions' ? 'text-right' : ''} ${isSortable ? 'cursor-pointer' : ''}`}
                      style={{ width: `${columnWidths[column]}px` }}
                      draggable
                      onDragStart={() => handleDragStart(column)}
                      onDragOver={(e) => handleDragOver(e, column)}
                      onDrop={() => handleDrop(column)}
                      onClick={() => isSortable && handleSort(config.sortKey!)}
                    >
                      <div className="flex items-center">
                        {config.label} {isSortable && getSortIcon(config.sortKey!)}
                      </div>
                      <div
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500 z-10"
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleResize(column, e.clientX, columnWidths[column])
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableHead>
                  )
                })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columnOrder
                    .filter((column) => columnVisibility[column] !== false)
                    .map((column) => (
                      <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths[column]}px` }}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                </TableRow>
              ))
            ) : activations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnOrder.filter((c) => columnVisibility[c] !== false).length} className="h-32 text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No billing activations found</p>
                </TableCell>
              </TableRow>
            ) : (
              activations.map((activation) => (
                <TableRow key={activation.id}>
                  {columnOrder
                    .filter((column) => columnVisibility[column] !== false)
                    .map((column) => {
                      const cellStyle = { width: `${columnWidths[column]}px` }
                      
                      switch (column) {
                        case 'date':
                          return (
                            <TableCell key={column} className="h-12 px-4 whitespace-nowrap" style={cellStyle}>
                              {activation.createdAt && format(new Date(activation.createdAt), 'PP p')}
                            </TableCell>
                          )
                        
                        case 'user':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              {activation.radiusUsername ? (
                                <button
                                  onClick={() => navigate(`/radius/users?search=${encodeURIComponent(activation.radiusUsername!)}`)}
                                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline cursor-pointer"
                                >
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">{activation.radiusUsername}</span>
                                </button>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">-</span>
                                </div>
                              )}
                            </TableCell>
                          )
                        
                        case 'type':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              {getTypeBadge(activation.activationType || '')}
                            </TableCell>
                          )
                        
                        case 'profile':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              <div className="text-sm">{activation.billingProfileName || '-'}</div>
                            </TableCell>
                          )
                        
                        case 'amount':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              {activation.amount ? (
                                <span className="font-medium">${activation.amount.toLocaleString()}</span>
                              ) : '-'}
                            </TableCell>
                          )
                        
                        case 'cashback':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              {activation.cashbackAmount ? (
                                <span className="font-medium text-green-600">${activation.cashbackAmount.toLocaleString()}</span>
                              ) : '-'}
                            </TableCell>
                          )
                        
                        case 'payment':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              <Badge variant="outline">{activation.paymentMethod || '-'}</Badge>
                            </TableCell>
                          )
                        
                        case 'status':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              {getStatusBadge(activation.activationStatus || '')}
                            </TableCell>
                          )
                        
                        case 'actionBy':
                          return (
                            <TableCell key={column} className="h-12 px-4" style={cellStyle}>
                              <div className="text-sm">
                                {activation.actionByUsername || '-'}
                                {activation.isActionBehalf && (
                                  <Badge variant="outline" className="ml-1 text-xs">Behalf</Badge>
                                )}
                              </div>
                            </TableCell>
                          )
                        
                        case 'actions':
                          return (
                            <TableCell key={column} className="h-12 px-4 text-right" style={cellStyle}>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSelectedActivation(activation)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )
                        
                        default:
                          return <TableCell key={column} style={cellStyle}>-</TableCell>
                      }
                    })}
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
            <DialogTitle>Billing Activation Details</DialogTitle>
            <DialogDescription>
              ID: {selectedActivation?.id} | {selectedActivation?.createdAt && format(new Date(selectedActivation.createdAt), 'PPpp')}
            </DialogDescription>
          </DialogHeader>
          {selectedActivation && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label className="text-muted-foreground">RADIUS Activation ID</Label>
                <p className="font-medium">{selectedActivation.radiusActivationId}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="font-medium">{selectedActivation.radiusUsername || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <div>{getTypeBadge(selectedActivation.activationType || '')}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div>{getStatusBadge(selectedActivation.activationStatus || '')}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Billing Profile</Label>
                <p className="font-medium">{selectedActivation.billingProfileName || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Payment Method</Label>
                <p>{selectedActivation.paymentMethod || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="font-medium">
                  {selectedActivation.amount ? `$${selectedActivation.amount.toLocaleString()}` : '-'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Cashback</Label>
                <p className="font-medium text-green-600">
                  {selectedActivation.cashbackAmount ? `$${selectedActivation.cashbackAmount.toLocaleString()}` : '-'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Duration</Label>
                <p>{selectedActivation.durationDays ? `${selectedActivation.durationDays} days` : '-'}</p>
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
                <Label className="text-muted-foreground">Action By</Label>
                <p>{selectedActivation.actionByUsername || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Action For</Label>
                <p>{selectedActivation.actionForUsername || '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">IP Address</Label>
                <p className="font-mono text-sm">{selectedActivation.ipAddress || '-'}</p>
              </div>
              {selectedActivation.userAgent && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">User Agent</Label>
                  <p className="text-sm bg-muted p-2 rounded break-all">{selectedActivation.userAgent}</p>
                </div>
              )}
              {selectedActivation.walletDistribution && (
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Wallet Distribution</Label>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                    {JSON.stringify(JSON.parse(selectedActivation.walletDistribution), null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Processing Started</Label>
                <p className="text-sm">{selectedActivation.processingStartedAt ? format(new Date(selectedActivation.processingStartedAt), 'PPp') : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Processing Completed</Label>
                <p className="text-sm">{selectedActivation.processingCompletedAt ? format(new Date(selectedActivation.processingCompletedAt), 'PPp') : '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Columns Confirmation Dialog */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Column Settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column widths, visibility, and order to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetColumns}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
