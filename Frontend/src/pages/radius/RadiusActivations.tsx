import { useState, useRef, useMemo, useCallback, memo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText, List, Users, Settings, Eye, CheckCircle2, XCircle, Clock, AlertCircle, Activity, Calendar, User, Filter, X } from 'lucide-react'
import { radiusActivationApi, type RadiusActivation } from '@/api/radiusActivationApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { workspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'
import { format } from 'date-fns'

export default function RadiusActivations() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentWorkspaceId } = useWorkspace()

  // Initialize state from URL params
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'))
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || 'createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'desc')

  // Filter state
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterApiStatus, setFilterApiStatus] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField && sortField !== 'createdAt') params.sortField = sortField
    if (sortDirection !== 'desc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection])

  // Dialog states
  const [selectedActivation, setSelectedActivation] = useState<RadiusActivation | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [activationToDelete, setActivationToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [activationToRestore, setActivationToRestore] = useState<number | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  
  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    checkbox: true,
    date: true,
    user: true,
    type: true,
    profile: true,
    amount: true,
    expiration: true,
    status: true,
    apiStatus: true,
    actionBy: true,
    actionFor: true,
    source: false,
    previousBalance: false,
    newBalance: false,
    previousExpiration: false,
    notes: false,
    externalRef: false,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    checkbox: 50,
    date: 140,
    user: 120,
    type: 100,
    profile: 130,
    amount: 100,
    expiration: 120,
    status: 100,
    apiStatus: 100,
    actionBy: 120,
    actionFor: 120,
    source: 100,
    previousBalance: 120,
    newBalance: 120,
    previousExpiration: 130,
    notes: 150,
    externalRef: 130,
    actions: 100,
  }

  const DEFAULT_COLUMN_ORDER = [
    'checkbox',
    'date',
    'user',
    'type',
    'profile',
    'amount',
    'expiration',
    'status',
    'apiStatus',
    'actionBy',
    'actionFor',
    'source',
    'previousBalance',
    'newBalance',
    'previousExpiration',
    'notes',
    'externalRef',
    'actions',
  ]

  // Column state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_COLUMN_WIDTHS)
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(DEFAULT_COLUMN_VISIBILITY)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // View state
  const [showTrash, setShowTrash] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Load table preferences
  const { data: preferences } = useQuery({
    queryKey: ['table-preferences', 'radius-activations'],
    queryFn: () => tablePreferenceApi.getPreferences('radius-activations'),
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

  // Auto-save preferences with debounce
  const savePreferencesTimeoutRef = useRef<NodeJS.Timeout>()
  useEffect(() => {
    if (!currentWorkspaceId) return
    
    if (savePreferencesTimeoutRef.current) {
      clearTimeout(savePreferencesTimeoutRef.current)
    }

    savePreferencesTimeoutRef.current = setTimeout(() => {
      tablePreferenceApi.savePreferences({
        tableName: 'radius-activations',
        columnWidths: JSON.stringify(columnWidths),
        columnOrder: JSON.stringify(columnOrder),
        columnVisibility: JSON.stringify(columnVisibility),
        sortField,
        sortDirection,
      }).catch(() => {
        // Silently fail - preferences are not critical
      })
    }, 1000)

    return () => {
      if (savePreferencesTimeoutRef.current) {
        clearTimeout(savePreferencesTimeoutRef.current)
      }
    }
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, currentWorkspaceId])

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
      sortField,
      sortDirection,
      showTrash
    ],
    queryFn: () =>
      showTrash 
        ? radiusActivationApi.getTrash(currentPage, pageSize)
        : radiusActivationApi.getAll({
            page: currentPage,
            pageSize,
            search: searchQuery || undefined,
            type: filterType || undefined,
            status: filterStatus || undefined,
            apiStatus: filterApiStatus || undefined,
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
      setActivationToDelete(null)
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error) || 'Failed to delete activation')
    }
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => radiusActivationApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success('Activation restored successfully')
      setActivationToRestore(null)
      setRestoreDialogOpen(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error) || 'Failed to restore activation')
    }
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => radiusActivationApi.delete(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success(`${selectedIds.length} activations deleted`)
      setSelectedIds([])
      setBulkActionLoading(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error) || 'Failed to delete activations')
      setBulkActionLoading(false)
    }
  })

  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => radiusActivationApi.restore(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-activations'] })
      toast.success(`${selectedIds.length} activations restored`)
      setSelectedIds([])
      setBulkActionLoading(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error) || 'Failed to restore activations')
      setBulkActionLoading(false)
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
    if (resizing) return // Prevent sort during resize
    
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
    setCurrentPage(1)
  }

  const hasFilters = searchQuery || filterType || filterStatus || filterApiStatus

  // Column resize handlers
  const handleResize = useCallback((column: string, startX: number, startWidth: number) => {
    setResizing(column)
    let hasMoved = false
    
    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
      const diff = e.clientX - startX
      const newWidth = Math.max(60, startWidth + diff) // Minimum width of 60px
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }))
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      
      // Delay clearing resizing state to prevent sort from triggering
      setTimeout(() => setResizing(null), 100)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [])

  // Column drag and drop handlers
  const handleDragStart = (column: string) => {
    if (column === 'checkbox' || column === 'actions') return
    setDraggedColumn(column)
  }

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault()
    if (column === 'checkbox' || column === 'actions') return
    setDragOverColumn(column)
  }

  const handleDrop = (targetColumn: string) => {
    if (!draggedColumn || targetColumn === 'checkbox' || targetColumn === 'actions' || draggedColumn === targetColumn) {
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
  }

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedIds.length === activations.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(activations.map(a => a.id))
    }
  }

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleResetColumns = () => {
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setSortField('createdAt')
    setSortDirection('desc')
    
    tablePreferenceApi.deletePreferences('radius-activations').catch(() => {})
    
    toast.success('Table columns reset to default')
    setResetColumnsDialogOpen(false)
  }

  const renderCell = (activation: RadiusActivation, column: string) => {
    switch (column) {
      case 'checkbox':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.checkbox}px` }}>
            <Checkbox
              checked={selectedIds.includes(activation.id)}
              onCheckedChange={() => handleSelectRow(activation.id)}
            />
          </TableCell>
        )
      case 'date':
        return (
          <TableCell key={column} className="h-12 px-4 whitespace-nowrap" style={{ width: `${columnWidths.date}px` }}>
            {format(new Date(activation.createdAt), 'PP p')}
          </TableCell>
        )
      case 'user':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.user}px` }}>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{activation.radiusUsername || '-'}</span>
            </div>
          </TableCell>
        )
      case 'type':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.type}px` }}>
            {getTypeBadge(activation.type)}
          </TableCell>
        )
      case 'profile':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.profile}px` }}>
            <div className="text-sm">
              {activation.radiusProfileName && <div>{activation.radiusProfileName}</div>}
              {activation.billingProfileName && (
                <div className="text-muted-foreground text-xs">{activation.billingProfileName}</div>
              )}
              {!activation.radiusProfileName && !activation.billingProfileName && '-'}
            </div>
          </TableCell>
        )
      case 'amount':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.amount}px` }}>
            {activation.amount ? (
              <span className="font-medium">{currencySymbol}{activation.amount.toLocaleString()}</span>
            ) : '-'}
          </TableCell>
        )
      case 'expiration':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.expiration}px` }}>
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
        )
      case 'status':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.status}px` }}>
            {getStatusBadge(activation.status)}
          </TableCell>
        )
      case 'apiStatus':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.apiStatus}px` }}>
            {getApiStatusBadge(activation.apiStatus)}
          </TableCell>
        )
      case 'actionBy':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.actionBy}px` }}>
            <div className="text-sm">
              {activation.actionByUsername || '-'}
              {activation.isActionBehalf && (
                <Badge variant="outline" className="ml-1 text-xs">Behalf</Badge>
              )}
            </div>
          </TableCell>
        )
      case 'actionFor':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.actionFor}px` }}>
            <div className="text-sm">
              {activation.actionForUsername || '-'}
            </div>
          </TableCell>
        )
      case 'source':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.source}px` }}>
            {activation.source || '-'}
          </TableCell>
        )
      case 'previousBalance':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.previousBalance}px` }}>
            {activation.previousBalance != null ? `${currencySymbol}${activation.previousBalance.toLocaleString()}` : '-'}
          </TableCell>
        )
      case 'newBalance':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.newBalance}px` }}>
            {activation.newBalance != null ? `${currencySymbol}${activation.newBalance.toLocaleString()}` : '-'}
          </TableCell>
        )
      case 'previousExpiration':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.previousExpiration}px` }}>
            {activation.previousExpireDate ? format(new Date(activation.previousExpireDate), 'PP') : '-'}
          </TableCell>
        )
      case 'notes':
        return (
          <TableCell key={column} className="h-12 px-4" style={{ width: `${columnWidths.notes}px` }}>
            <div className="max-w-[200px] truncate">{activation.notes || '-'}</div>
          </TableCell>
        )
      case 'externalRef':
        return (
          <TableCell key={column} className="h-12 px-4 font-mono text-xs" style={{ width: `${columnWidths.externalRef}px` }}>
            <div className="max-w-[180px] truncate">{activation.externalReferenceId || '-'}</div>
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={column} className="h-12 px-4 text-right sticky right-0 bg-background" style={{ width: `${columnWidths.actions}px` }}>
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedActivation(activation)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {showTrash ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setActivationToRestore(activation.id)
                    setRestoreDialogOpen(true)
                  }}
                  title="Restore"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setActivationToDelete(activation.id)
                    setDeleteDialogOpen(true)
                  }}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        )
      default:
        return null
    }
  }

  // Column definitions for header
  const getColumnHeader = (column: string) => {
    const headers: Record<string, { label: string; sortable: boolean }> = {
      checkbox: { label: '', sortable: false },
      date: { label: 'Date', sortable: true },
      user: { label: 'User', sortable: true },
      type: { label: 'Type', sortable: true },
      profile: { label: 'Profile', sortable: false },
      amount: { label: 'Amount', sortable: true },
      expiration: { label: 'Expiration', sortable: false },
      status: { label: 'Status', sortable: true },
      apiStatus: { label: 'API Status', sortable: true },
      actionBy: { label: 'Action By', sortable: false },
      actionFor: { label: 'Action For', sortable: false },
      source: { label: 'Source', sortable: false },
      previousBalance: { label: 'Prev Balance', sortable: false },
      newBalance: { label: 'New Balance', sortable: false },
      previousExpiration: { label: 'Prev Expiration', sortable: false },
      notes: { label: 'Notes', sortable: false },
      externalRef: { label: 'External Ref', sortable: false },
      actions: { label: 'Actions', sortable: false },
    }
    return headers[column] || { label: column, sortable: false }
  }

  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const showPages = 5
    
    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= showPages; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - showPages + 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

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
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(v) => {
            setShowTrash(v === 'trash')
            setCurrentPage(1)
            setSelectedIds([])
          }}>
            <TabsList>
              <TabsTrigger value="active" className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                Active
              </TabsTrigger>
              <TabsTrigger value="trash" className="flex items-center gap-1.5">
                <Archive className="h-4 w-4" />
                Trash
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {!showTrash && (
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
          )}
          <Button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-activations'] })}
            variant="outline"
            size="icon"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {!showTrash && (
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
                        {types?.map((type) => (
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
                        {statuses?.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>API Status</Label>
                    <Select value={filterApiStatus || 'all'} onValueChange={(v) => { setFilterApiStatus(v === 'all' ? '' : v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All API Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All API Statuses</SelectItem>
                        {apiStatuses?.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Columns">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="flex justify-between px-2 py-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColumnVisibility(Object.keys(DEFAULT_COLUMN_VISIBILITY).reduce((acc, key) => ({ ...acc, [key]: true }), {}))}
                >
                  Show All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setColumnVisibility(Object.keys(DEFAULT_COLUMN_VISIBILITY).reduce((acc, key) => ({ ...acc, [key]: false }), {}))}
                >
                  Hide All
                </Button>
              </div>
              <DropdownMenuSeparator />
              <div className="max-h-[400px] overflow-y-auto">
                {Object.keys(DEFAULT_COLUMN_VISIBILITY).map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column}
                    checked={columnVisibility[column] !== false}
                    onCheckedChange={(checked) =>
                      setColumnVisibility(prev => ({ ...prev, [column]: checked }))
                    }
                  >
                    {getColumnHeader(column).label || column}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Table Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setResetColumnsDialogOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Columns
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border relative">
        {isFetching && !isLoading && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columnOrder.filter(col => columnVisibility[col] !== false).map((column) => {
                  const header = getColumnHeader(column)
                  const isCheckbox = column === 'checkbox'
                  const isActions = column === 'actions'
                  
                  return (
                    <TableHead
                      key={column}
                      className={`h-12 px-4 font-semibold relative select-none ${
                        header.sortable && !isCheckbox && !isActions ? 'cursor-pointer hover:bg-muted/80' : ''
                      } ${dragOverColumn === column ? 'bg-muted' : ''} ${
                        isActions ? 'sticky right-0 bg-muted/50' : ''
                      }`}
                      style={{ width: `${columnWidths[column]}px` }}
                      onClick={() => header.sortable && handleSort(column === 'date' ? 'createdAt' : column === 'user' ? 'radiusUsername' : column)}
                      draggable={!isCheckbox && !isActions}
                      onDragStart={() => handleDragStart(column)}
                      onDragOver={(e) => handleDragOver(e, column)}
                      onDrop={() => handleDrop(column)}
                    >
                      {isCheckbox ? (
                        <Checkbox
                          checked={selectedIds.length === activations.length && activations.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      ) : (
                        <div className="flex items-center">
                          {header.label}
                          {header.sortable && getSortIcon(column === 'date' ? 'createdAt' : column === 'user' ? 'radiusUsername' : column)}
                        </div>
                      )}
                      {!isCheckbox && !isActions && (
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors z-10"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onMouseDown={(e) => { 
                            e.preventDefault()
                            e.stopPropagation()
                            const width = columnWidths[column] ?? DEFAULT_COLUMN_WIDTHS[column as keyof typeof DEFAULT_COLUMN_WIDTHS] ?? 100
                            handleResize(column, e.clientX, width)
                          }}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {columnOrder.filter(col => columnVisibility[col] !== false).map((col) => (
                      <TableCell key={col} className="h-12 px-4">
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : activations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnOrder.filter(col => columnVisibility[col] !== false).length} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      {showTrash ? (
                        <Archive className="h-8 w-8 text-muted-foreground" />
                      ) : (
                        <Activity className="h-8 w-8 text-muted-foreground" />
                      )}
                      <p className="text-muted-foreground">
                        {showTrash ? 'No deleted activations found' : 'No activations found'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                activations.map((activation) => (
                  <TableRow key={activation.id} className={selectedIds.includes(activation.id) ? 'bg-muted/50' : ''}>
                    {columnOrder.filter(col => columnVisibility[col] !== false).map((column) => renderCell(activation, column))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
            <SelectTrigger className="w-24">
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
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2">...</span>
              ) : (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page as number)}
                  className="min-w-[2.5rem]"
                >
                  {page}
                </Button>
              )
            )}
          </div>
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

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4">
          <span className="font-medium">{selectedIds.length} selected</span>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex gap-2">
            {showTrash ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBulkActionLoading(true)
                  bulkRestoreMutation.mutate(selectedIds)
                }}
                disabled={bulkActionLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restore Selected
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBulkActionLoading(true)
                  bulkDeleteMutation.mutate(selectedIds)
                }}
                disabled={bulkActionLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedIds([])}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

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
            <div className="grid grid-cols-2 gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="font-medium">{selectedActivation.radiusUsername}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <div>{getTypeBadge(selectedActivation.type)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div>{getStatusBadge(selectedActivation.status)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">API Status</Label>
                <div>{getApiStatusBadge(selectedActivation.apiStatus)}</div>
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
                <p>{selectedActivation.previousBalance != null ? `${currencySymbol}${selectedActivation.previousBalance.toLocaleString()}` : '-'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">New Balance</Label>
                <p className="font-medium">{selectedActivation.newBalance != null ? `${currencySymbol}${selectedActivation.newBalance.toLocaleString()}` : '-'}</p>
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
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activation record? This will revert the user's expiration date to the previous value. This can only be done if the next expire date hasn't passed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activationToDelete && deleteMutation.mutate(activationToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Activation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this activation record? This will restore the user's expiration date to the activation value. This can only be done if the next expire date hasn't passed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => activationToRestore && restoreMutation.mutate(activationToRestore)}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Columns Confirmation */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Table Columns</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column widths, visibility, order, and sorting to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetColumns}>
              Reset Columns
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
