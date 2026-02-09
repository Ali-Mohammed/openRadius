import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, CreditCard, Settings, RotateCcw, Eye, Loader2, ExternalLink, Database, Wifi, WifiOff } from 'lucide-react'
import { paymentApi, type PaymentLog, type PaymentInquiryResponse } from '@/api/paymentApi'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'

export default function PaymentInformation() {
  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    transactionId: true,
    user: true,
    gateway: true,
    amount: true,
    status: true,
    environment: true,
    gatewayReference: true,
    date: true,
    errorMessage: true,
    actions: true,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    transactionId: 200,
    user: 180,
    gateway: 140,
    amount: 150,
    status: 140,
    environment: 120,
    gatewayReference: 200,
    date: 180,
    errorMessage: 250,
    actions: 90,
  }

  const DEFAULT_COLUMN_ORDER = [
    'transactionId',
    'user',
    'gateway',
    'amount',
    'status',
    'environment',
    'gatewayReference',
    'date',
    'errorMessage',
    'actions',
  ]

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [inquirySheetOpen, setInquirySheetOpen] = useState(false)
  const [inquiryData, setInquiryData] = useState<PaymentInquiryResponse | null>(null)
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [inquiryError, setInquiryError] = useState<string | null>(null)
  
  // Load table preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('payment-history')
        if (preferences) {
          if (preferences.columnWidths) {
            setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(preferences.columnWidths) })
          }
          if (preferences.columnOrder) {
            setColumnOrder(JSON.parse(preferences.columnOrder))
          }
          if (preferences.columnVisibility) {
            setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(preferences.columnVisibility) })
          }
          if (preferences.sortField) {
            setSortField(preferences.sortField)
            setSortDirection((preferences.sortDirection as 'asc' | 'desc') || 'desc')
          }
        }
      } catch (error) {
        console.log('No saved preferences found', error)
      } finally {
        setPreferencesLoaded(true)
      }
    }

    loadPreferences()
  }, [])

  // Auto-save preferences when they change
  useEffect(() => {
    if (!preferencesLoaded) return

    const savePreferences = async () => {
      try {
        await tablePreferenceApi.savePreference({
          tableName: 'payment-history',
          columnWidths: JSON.stringify(columnWidths),
          columnOrder: JSON.stringify(columnOrder),
          columnVisibility: JSON.stringify(columnVisibility),
          sortField: sortField || undefined,
          sortDirection: sortDirection,
        })
        console.log('Table preferences saved successfully')
      } catch (error) {
        console.error('Failed to save table preferences:', error)
      }
    }

    const timeoutId = setTimeout(savePreferences, 1000)
    return () => clearTimeout(timeoutId)
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, preferencesLoaded])
  
  const { data: paymentHistory, isLoading: isLoadingHistory, isFetching, refetch } = useQuery({
    queryKey: ['payment-history', statusFilter, searchQuery, currentPage, pageSize, sortField, sortDirection],
    queryFn: () => paymentApi.getPaymentHistory({ 
      pageNumber: currentPage,
      pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter
    }),
  })

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const handleSort = useCallback((field: string) => {
    if (resizing) return
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }, [sortField, sortDirection, resizing])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

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

  const handleColumnDragStart = useCallback((e: React.DragEvent, column: string) => {
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, column: string) => {
    if (!draggingColumn) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingColumn !== column) {
      setDragOverColumn(column)
    }
  }, [draggingColumn])

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    
    if (!draggingColumn || draggingColumn === targetColumn) {
      setDraggingColumn(null)
      setDragOverColumn(null)
      return
    }

    setColumnOrder(prev => {
      const newOrder = [...prev]
      const dragIndex = newOrder.indexOf(draggingColumn)
      const dropIndex = newOrder.indexOf(targetColumn)
      
      newOrder.splice(dragIndex, 1)
      newOrder.splice(dropIndex, 0, draggingColumn)
      
      return newOrder
    })

    setDraggingColumn(null)
    setDragOverColumn(null)
  }, [draggingColumn])

  const handleColumnDragEnd = useCallback(() => {
    setDraggingColumn(null)
    setDragOverColumn(null)
  }, [])

  const handleResetColumns = () => {
    setResetColumnsDialogOpen(true)
  }

  const confirmResetColumns = async () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    setResetColumnsDialogOpen(false)
  }

  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      pages.push(total)
    }
    
    return pages
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case 'failed':
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatNumber = (num: number) => num.toLocaleString()

  const handleInquiry = async (log: PaymentLog) => {
    setInquirySheetOpen(true)
    setInquiryData(null)
    setInquiryError(null)
    setInquiryLoading(true)
    try {
      const data = await paymentApi.inquirePayment(log.uuid)
      setInquiryData(data)
    } catch (err: any) {
      setInquiryError(err?.response?.data?.message || err?.message || 'Failed to fetch payment details')
    } finally {
      setInquiryLoading(false)
    }
  }

  // Mock pagination for now (backend doesn't return pagination info yet)
  const totalRecords = paymentHistory?.length || 0
  const totalPages = Math.ceil(totalRecords / pageSize)
  
  const pagination = {
    totalRecords,
    totalPages,
    currentPage,
    pageSize
  }

  const renderColumnHeader = (columnKey: string) => {
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnVisibility[visibilityKey] === false) {
      return null
    }

    const columnConfig: Record<string, { label: string; sortKey?: string; sortable?: boolean }> = {
      transactionId: { label: 'Transaction ID', sortKey: 'transactionId', sortable: true },
      user: { label: 'User', sortKey: 'userName', sortable: true },
      gateway: { label: 'Gateway', sortKey: 'gateway', sortable: true },
      amount: { label: 'Amount', sortKey: 'amount', sortable: true },
      status: { label: 'Status', sortKey: 'status', sortable: true },
      environment: { label: 'Environment', sortKey: 'environment', sortable: true },
      gatewayReference: { label: 'Gateway Reference', sortKey: 'gatewayTransactionId', sortable: false },
      date: { label: 'Date', sortKey: 'createdAt', sortable: true },
      errorMessage: { label: 'Error Message', sortKey: 'errorMessage', sortable: false },
      actions: { label: 'Actions', sortable: false },
    }

    const config = columnConfig[columnKey]
    if (!config) return null

    const isSortable = config.sortable !== false
    const sortableClass = isSortable ? 'cursor-pointer select-none hover:bg-muted/50' : ''
    const dragClasses = draggingColumn === columnKey ? 'opacity-50' : dragOverColumn === columnKey ? 'border-l-4 border-primary' : ''
    const baseClasses = 'h-12 px-4 relative'
    const alignmentClass = columnKey === 'amount' ? 'text-right' : ''

    return (
      <TableHead
        key={columnKey}
        className={`${baseClasses} ${alignmentClass} ${sortableClass} ${dragClasses}`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={isSortable && config.sortKey ? () => handleSort(config.sortKey!) : undefined}
        draggable={true}
        onDragStart={(e) => handleColumnDragStart(e, columnKey)}
        onDragOver={(e) => handleColumnDragOver(e, columnKey)}
        onDrop={(e) => handleColumnDrop(e, columnKey)}
        onDragEnd={handleColumnDragEnd}
      >
        {config.label}
        {isSortable && config.sortKey && getSortIcon(config.sortKey)}
        <div 
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onMouseDown={(e) => { 
            e.preventDefault()
            e.stopPropagation() 
            handleResize(columnKey, e.clientX, columnWidths[columnKey as keyof typeof columnWidths])
          }}
        />
      </TableHead>
    )
  }

  const renderTableCell = (columnKey: string, log: PaymentLog) => {
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnVisibility[visibilityKey] === false) {
      return null
    }

    const baseStyle = { width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }

    switch (columnKey) {
      case 'transactionId':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-mono text-xs" style={baseStyle}>
            {log.transactionId.substring(0, 16)}...
          </TableCell>
        )
      case 'user':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {log.userName || log.userEmail || '-'}
          </TableCell>
        )
      case 'gateway':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant="outline">{log.gateway}</Badge>
          </TableCell>
        )
      case 'amount':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-medium text-right" style={baseStyle}>
            {log.amount.toLocaleString()} {log.currency}
          </TableCell>
        )
      case 'status':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {getStatusBadge(log.status)}
          </TableCell>
        )
      case 'environment':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={log.environment === 'Production' ? 'destructive' : 'secondary'}>
              {log.environment || 'Unknown'}
            </Badge>
          </TableCell>
        )
      case 'gatewayReference':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-mono text-xs" style={baseStyle}>
            {log.gatewayTransactionId || log.referenceId || '-'}
          </TableCell>
        )
      case 'date':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-sm text-muted-foreground" style={baseStyle}>
            {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
          </TableCell>
        )
      case 'errorMessage':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-xs text-destructive" style={baseStyle}>
            <div className="max-w-[250px] truncate" title={log.errorMessage || ''}>
              {log.errorMessage || '-'}
            </div>
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Inquire from gateway"
              onClick={() => handleInquiry(log)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TableCell>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment History</h1>
          <p className="text-sm text-muted-foreground">View all payment transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search transactions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Toggle columns">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columnVisibility.transactionId}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, transactionId: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Transaction ID
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.user}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, user: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                User
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.gateway}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, gateway: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Gateway
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.amount}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, amount: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.status}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.environment}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, environment: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Environment
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.gatewayReference}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, gatewayReference: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Gateway Reference
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.date}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, date: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.errorMessage}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, errorMessage: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Error Message
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.actions}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, actions: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Actions
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Table settings">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleResetColumns}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset Columns
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoadingHistory ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    {Array.from({ length: 7 }).map((_, i) => (
                      <TableHead key={i} className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j} className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isLoadingHistory && (!paymentHistory || paymentHistory.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <CreditCard className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No payment history found</h3>
              <p className="text-sm text-muted-foreground mb-6">Your payment transactions will appear here</p>
            </div>
          ) : paymentHistory && paymentHistory.length > 0 ? (
            <div className="overflow-auto" style={{ height: 'calc(100vh - 220px)' }}>
              {isFetching && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <div className="bg-background p-4 rounded-lg shadow-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Refreshing...</span>
                    </div>
                  </div>
                </div>
              )}
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                    {columnOrder.map(column => renderColumnHeader(column))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((log: PaymentLog) => (
                    <TableRow key={log.uuid} className="border-b">
                      {columnOrder.map(column => renderTableCell(column, log))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {/* Pagination Controls */}
          {pagination && paymentHistory && paymentHistory.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Per Page</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-8 w-[70px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground font-medium">
                  Showing {formatNumber(paymentHistory.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + paymentHistory.length)} of {formatNumber(pagination.totalRecords)} transactions
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {getPaginationPages(currentPage, pagination.totalPages).map((page, idx) => (
                  page === '...' ? (
                    <Button
                      key={`ellipsis-${idx}`}
                      variant="ghost"
                      size="icon"
                      disabled
                      className="h-8 w-8 p-0 text-sm"
                    >
                      ...
                    </Button>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setCurrentPage(page as number)}
                      className="h-8 w-8 p-0 text-sm font-medium"
                    >
                      {page}
                    </Button>
                  )
                ))}
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(pagination.totalPages)}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Columns Confirmation Dialog */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Columns</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column customizations (visibility, width, order) to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetColumns} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Inquiry Sheet */}
      <Sheet open={inquirySheetOpen} onOpenChange={setInquirySheetOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-hidden flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Payment Inquiry
            </SheetTitle>
            <SheetDescription>
              Detailed payment information from stored data and live gateway query
            </SheetDescription>
          </SheetHeader>

          {inquiryLoading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Querying payment gateway...</p>
            </div>
          )}

          {inquiryError && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{inquiryError}</p>
              <Button variant="outline" size="sm" onClick={() => setInquirySheetOpen(false)}>
                Close
              </Button>
            </div>
          )}

          {inquiryData && !inquiryLoading && (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-6">
                {/* Status Overview */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
                    <div className="mt-1">{getStatusBadge(inquiryData.status)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Amount</p>
                    <p className="text-lg font-bold mt-1">{inquiryData.amount.toLocaleString()} {inquiryData.currency}</p>
                  </div>
                </div>

                {/* Transaction Details */}
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Database className="h-4 w-4" />
                    Transaction Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Transaction ID</p>
                      <p className="font-mono text-xs break-all">{inquiryData.transactionId}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Gateway</p>
                      <Badge variant="outline">{inquiryData.gateway}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Environment</p>
                      <Badge variant={inquiryData.environment === 'Production' ? 'destructive' : 'secondary'}>
                        {inquiryData.environment || 'Unknown'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Service Type</p>
                      <p>{inquiryData.serviceType || '-'}</p>
                    </div>
                    {inquiryData.referenceId && (
                      <div>
                        <p className="text-muted-foreground text-xs">Reference ID</p>
                        <p className="font-mono text-xs break-all">{inquiryData.referenceId}</p>
                      </div>
                    )}
                    {inquiryData.gatewayTransactionId && (
                      <div>
                        <p className="text-muted-foreground text-xs">Gateway Transaction ID</p>
                        <p className="font-mono text-xs break-all">{inquiryData.gatewayTransactionId}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Created</p>
                      <p>{format(new Date(inquiryData.createdAt), 'MMM dd, yyyy HH:mm:ss')}</p>
                    </div>
                    {inquiryData.completedAt && (
                      <div>
                        <p className="text-muted-foreground text-xs">Completed</p>
                        <p>{format(new Date(inquiryData.completedAt), 'MMM dd, yyyy HH:mm:ss')}</p>
                      </div>
                    )}
                    {inquiryData.errorMessage && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Error</p>
                        <p className="text-destructive text-xs">{inquiryData.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Live Gateway Data */}
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    {inquiryData.liveData?.success ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    Live Gateway Response
                  </h4>
                  {inquiryData.liveData ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        {inquiryData.liveData.success ? (
                          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Connected</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" />Not Available</Badge>
                        )}
                        {inquiryData.liveData.gatewayStatus && (
                          <Badge variant="outline">Gateway: {inquiryData.liveData.gatewayStatus}</Badge>
                        )}
                      </div>
                      {inquiryData.liveData.errorMessage && (
                        <p className="text-xs text-muted-foreground">{inquiryData.liveData.errorMessage}</p>
                      )}
                      {inquiryData.liveData.queriedAt && (
                        <p className="text-xs text-muted-foreground">
                          Queried at: {format(new Date(inquiryData.liveData.queriedAt), 'MMM dd, yyyy HH:mm:ss')}
                        </p>
                      )}
                      {inquiryData.liveData.rawResponse && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Raw Response</p>
                          <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap break-all">
                            {JSON.stringify(inquiryData.liveData.rawResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No live data available</p>
                  )}
                </div>

                {/* Stored Gateway Data */}
                {(inquiryData.requestData || inquiryData.responseData || inquiryData.callbackData) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Database className="h-4 w-4" />
                        Stored Gateway Data
                      </h4>
                      <div className="space-y-3">
                        {inquiryData.requestData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Request Data</p>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap break-all">
                              {JSON.stringify(inquiryData.requestData, null, 2)}
                            </pre>
                          </div>
                        )}
                        {inquiryData.responseData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Response Data</p>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap break-all">
                              {JSON.stringify(inquiryData.responseData, null, 2)}
                            </pre>
                          </div>
                        )}
                        {inquiryData.callbackData && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Callback Data</p>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap break-all">
                              {JSON.stringify(inquiryData.callbackData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
