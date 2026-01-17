import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, RotateCcw, Settings, List, Network, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { radiusIpReservationApi, type RadiusIpReservation } from '@/api/radiusIpReservationApi'
import { radiusUserApi } from '@/api/radiusUserApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'

export default function RadiusIpReservations() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentWorkspaceId } = useWorkspace()

  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'))
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')
  const [showTrash, setShowTrash] = useState(false)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<RadiusIpReservation | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [reservationToRestore, setReservationToRestore] = useState<number | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    ipAddress: '',
    description: '',
    radiusUserId: ''
  })

  const [selectedReservationIds, setSelectedReservationIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [formErrors, setFormErrors] = useState<{ ipAddress?: string; radiusUserId?: string }>({})

  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    ipAddress: true,
    description: true,
    username: true,
    name: true,
    profile: true,
    zone: false,
    group: false,
    createdAt: false,
    updatedAt: false,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    checkbox: 50,
    ipAddress: 180,
    description: 250,
    username: 200,
    name: 180,
    profile: 150,
    zone: 150,
    group: 150,
    createdAt: 160,
    updatedAt: 160,
    actions: 140,
  }

  const DEFAULT_COLUMN_ORDER = [
    'checkbox',
    'ipAddress',
    'description',
    'username',
    'name',
    'profile',
    'zone',
    'group',
    'createdAt',
    'updatedAt',
    'actions',
  ]

  // Column state
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  // IP address validation function
  const isValidIPAddress = (ip: string): boolean => {
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    return ipPattern.test(ip)
  }

  // Load table preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('radius-ip-reservations')
        if (preferences) {
          if (preferences.columnWidths) {
            setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(preferences.columnWidths) })
          }
          if (preferences.columnOrder) {
            const savedOrder = JSON.parse(preferences.columnOrder)
            // Ensure checkbox and actions columns are always present
            const ensuredOrder = [
              'checkbox',
              ...savedOrder.filter((col: string) => col !== 'checkbox' && col !== 'actions'),
              'actions'
            ]
            setColumnOrder(ensuredOrder)
          }
          if (preferences.columnVisibility) {
            setColumnVisibility({ ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(preferences.columnVisibility) })
          }
          if (preferences.sortField) {
            setSortField(preferences.sortField)
            setSortDirection((preferences.sortDirection as 'asc' | 'desc') || 'asc')
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
          tableName: 'radius-ip-reservations',
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
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, currentWorkspaceId, preferencesLoaded])

  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection])

  const { data: reservationsData, isLoading, isFetching } = useQuery({
    queryKey: ['radius-ip-reservations', currentWorkspaceId, currentPage, pageSize, searchQuery, sortField, sortDirection, showTrash],
    queryFn: () => radiusIpReservationApi.getAll({
      page: currentPage,
      pageSize,
      search: searchQuery,
      sortField,
      sortDirection,
      onlyDeleted: showTrash
    }),
    enabled: !!currentWorkspaceId,
  })

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['radius-users-search', currentWorkspaceId, userSearch],
    queryFn: () => radiusUserApi.getAll(1, 100, userSearch || undefined),
    enabled: !!currentWorkspaceId,
  })

  const reservations = useMemo(() => reservationsData?.data || [], [reservationsData])
  const pagination = reservationsData?.pagination
  const users = useMemo(() => usersData?.data || [], [usersData])

  const rowVirtualizer = useVirtualizer({
    count: reservations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => radiusIpReservationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-reservations', currentWorkspaceId] })
      toast.success('IP reservation created successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => radiusIpReservationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-reservations', currentWorkspaceId] })
      toast.success('IP reservation updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => radiusIpReservationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-reservations', currentWorkspaceId] })
      toast.success('IP reservation moved to trash')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => radiusIpReservationApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-reservations', currentWorkspaceId] })
      toast.success('IP reservation restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const handleOpenDialog = (reservation?: RadiusIpReservation) => {
    if (reservation) {
      setEditingReservation(reservation)
      setFormData({
        ipAddress: reservation.ipAddress,
        description: reservation.description || '',
        radiusUserId: reservation.radiusUserId?.toString() || ''
      })
    } else {
      setEditingReservation(null)
      setFormData({
        ipAddress: '',
        description: '',
        radiusUserId: ''
      })
    }
    setFormErrors({})
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingReservation(null)
  }

  const handleSave = async () => {
    const errors: { ipAddress?: string; radiusUserId?: string } = {}

    // Validate IP address
    if (!formData.ipAddress.trim()) {
      errors.ipAddress = 'IP address is required'
    } else if (!isValidIPAddress(formData.ipAddress.trim())) {
      errors.ipAddress = 'Invalid IP address format (e.g., 192.168.1.100)'
    } else {
      // Check for duplicate IP in current data
      const duplicateIp = reservations.find(
        r => r.ipAddress === formData.ipAddress.trim() && 
        r.id !== editingReservation?.id &&
        !r.deletedAt
      )
      if (duplicateIp) {
        errors.ipAddress = 'This IP address is already reserved'
      }
    }

    // Check for duplicate user
    if (formData.radiusUserId) {
      const duplicateUser = reservations.find(
        r => r.radiusUserId?.toString() === formData.radiusUserId && 
        r.id !== editingReservation?.id &&
        !r.deletedAt
      )
      if (duplicateUser) {
        errors.radiusUserId = 'This user already has an IP reservation'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    const data = {
      ipAddress: formData.ipAddress.trim(),
      description: formData.description.trim() || null,
      radiusUserId: formData.radiusUserId ? parseInt(formData.radiusUserId) : null
    }

    if (editingReservation) {
      updateMutation.mutate({ id: editingReservation.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: number) => {
    setReservationToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (reservationToDelete) {
      deleteMutation.mutate(reservationToDelete)
      setDeleteDialogOpen(false)
      setReservationToDelete(null)
    }
  }

  const handleRestore = (id: number) => {
    setReservationToRestore(id)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (reservationToRestore) {
      restoreMutation.mutate(reservationToRestore)
      setRestoreDialogOpen(false)
      setReservationToRestore(null)
    }
  }

  const handleSort = useCallback((field: string) => {
    if (resizing) return
    
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection, resizing])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

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
  const handleColumnDragStart = useCallback((e: React.DragEvent, column: string) => {
    if (column === 'actions') return
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
      dragImage.style.opacity = '0.5'
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, column: string) => {
    if (!draggingColumn || column === 'actions') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingColumn !== column) {
      setDragOverColumn(column)
    }
  }, [draggingColumn])

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    
    if (!draggingColumn || draggingColumn === targetColumn || targetColumn === 'actions') {
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

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      } else if (current >= total - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = total - 4; i <= total; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = current - 1; i <= current + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      }
    }
    
    return pages
  }, [])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReservationIds(reservations.map(r => r.id))
    } else {
      setSelectedReservationIds([])
    }
  }

  const handleSelectReservation = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedReservationIds(prev => [...prev, id])
    } else {
      setSelectedReservationIds(prev => prev.filter(resId => resId !== id))
    }
  }

  const handleResetColumns = () => {
    setResetColumnsDialogOpen(true)
  }

  const confirmResetColumns = async () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    
    try {
      await tablePreferenceApi.deletePreference('radius-ip-reservations')
      toast.success('Table columns reset to defaults')
    } catch (error) {
      console.error('Failed to delete preferences:', error)
      toast.error('Columns reset but failed to clear saved preferences')
    }
    
    setResetColumnsDialogOpen(false)
  }

  // Helper function to render column header
  const renderColumnHeader = (columnKey: string) => {
    const columnConfig: Record<string, { label: string | React.ReactElement, sortKey?: string, draggable?: boolean }> = {
      checkbox: { label: <Checkbox checked={selectedReservationIds.length === reservations.length && reservations.length > 0} onCheckedChange={handleSelectAll} />, draggable: false },
      ipAddress: { label: 'IP Address', sortKey: 'ipaddress' },
      description: { label: 'Description', sortKey: 'description' },
      username: { label: 'Username', sortKey: 'username' },
      name: { label: 'Name' },
      profile: { label: 'Profile' },
      zone: { label: 'Zone' },
      group: { label: 'Group' },
      createdAt: { label: 'Created At', sortKey: 'createdAt' },
      updatedAt: { label: 'Updated At', sortKey: 'updatedAt' },
      actions: { label: 'Actions', draggable: false },
    }

    const config = columnConfig[columnKey]
    if (!config) return null

    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'checkbox' && columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const isDraggable = config.draggable !== false && columnKey !== 'checkbox' && columnKey !== 'actions'
    const isSortable = !!config.sortKey
    const isDragging = draggingColumn === columnKey
    const isDragOver = dragOverColumn === columnKey

    const baseClasses = "h-12 px-4 font-semibold whitespace-nowrap select-none relative"
    const sortableClass = isSortable ? 'cursor-pointer' : ''
    const dragClasses = isDragging ? 'opacity-50' : isDragOver ? 'bg-blue-100 dark:bg-blue-900' : ''
    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-muted z-10' : ''
    
    return (
      <TableHead
        key={columnKey}
        className={`${baseClasses} ${sortableClass} ${dragClasses} ${stickyClass}`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={isSortable ? () => handleSort(config.sortKey!) : undefined}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleColumnDragStart(e, columnKey) : undefined}
        onDragOver={isDraggable ? (e) => handleColumnDragOver(e, columnKey) : undefined}
        onDrop={isDraggable ? (e) => handleColumnDrop(e, columnKey) : undefined}
        onDragEnd={isDraggable ? handleColumnDragEnd : undefined}
      >
        <div className="flex items-center">
          {typeof config.label === 'string' ? config.label : config.label}
          {isSortable && getSortIcon(config.sortKey!)}
        </div>
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

  // Helper function to render table cell
  const renderTableCell = (columnKey: string, reservation: RadiusIpReservation) => {
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-background z-10' : ''
    const baseStyle = { width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }

    switch (columnKey) {
      case 'checkbox':
        return (
          <TableCell key={columnKey} className="px-4" style={baseStyle}>
            <Checkbox
              checked={selectedReservationIds.includes(reservation.id)}
              onCheckedChange={(checked) => handleSelectReservation(reservation.id, checked as boolean)}
            />
          </TableCell>
        )
      case 'ipAddress':
        return (
          <TableCell key={columnKey} className="px-4 font-mono" style={baseStyle}>
            {reservation.ipAddress}
          </TableCell>
        )
      case 'description':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} title={reservation.description || '-'}>
            {reservation.description || '-'}
          </TableCell>
        )
      case 'username':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} title={reservation.username || '-'}>
            {reservation.username || '-'}
          </TableCell>
        )
      case 'name':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} 
            title={[reservation.firstname, reservation.lastname].filter(Boolean).join(' ') || '-'}>
            {[reservation.firstname, reservation.lastname].filter(Boolean).join(' ') || '-'}
          </TableCell>
        )
      case 'profile':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} title={reservation.profileName || '-'}>
            {reservation.profileName || '-'}
          </TableCell>
        )
      case 'zone':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} title={reservation.zoneName || '-'}>
            {reservation.zoneName || '-'}
          </TableCell>
        )
      case 'group':
        return (
          <TableCell key={columnKey} className="px-4 truncate" style={baseStyle} title={reservation.groupName || '-'}>
            {reservation.groupName || '-'}
          </TableCell>
        )
      case 'createdAt':
        return (
          <TableCell key={columnKey} className="px-4" style={baseStyle}>
            {reservation.createdAt ? new Date(reservation.createdAt).toLocaleDateString() : '-'}
          </TableCell>
        )
      case 'updatedAt':
        return (
          <TableCell key={columnKey} className="px-4" style={baseStyle}>
            {reservation.updatedAt ? new Date(reservation.updatedAt).toLocaleDateString() : '-'}
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className={`px-4 ${stickyClass}`} style={baseStyle}>
            <div className="flex justify-end gap-2">
              {showTrash ? (
                <Button variant="outline" size="sm" onClick={() => handleRestore(reservation.id)}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(reservation)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(reservation.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
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
          <h1 className="text-2xl font-bold">IP Reservations</h1>
          <p className="text-sm text-muted-foreground">Manage RADIUS IP address reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
            <TabsList>
              <TabsTrigger value="active">
                <Network className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="trash">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search IP reservations..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-ip-reservations', currentWorkspaceId] })} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" title="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="end">
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start" 
                    onClick={handleResetColumns}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reset Columns
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={showTrash}>
            <Plus className="h-4 w-4 mr-2" />
            Add Reservation
          </Button>
        </div>
      </div>

      <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
        <TabsContent value={showTrash ? 'trash' : 'active'} className="mt-0">
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-hidden relative">
              {isLoading ? (
                <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="sticky right-0 bg-background h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="sticky right-0 bg-background h-12 px-4">
                            <div className="flex justify-end gap-2">
                              <Skeleton className="h-8 w-8 rounded" />
                              <Skeleton className="h-8 w-8 rounded" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : reservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Network className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No IP Reservations Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Get started by adding your first IP reservation</p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Reservation
                  </Button>
                </div>
              ) : (
                <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 220px)' }}>
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
                        {columnOrder.map(columnKey => renderColumnHeader(columnKey))}
                      </TableRow>
                    </TableHeader>
                    
                    <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const reservation = reservations[virtualRow.index]
                        return (
                          <TableRow 
                            key={reservation.id}
                            className="border-b"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                              transform: `translateY(${virtualRow.start}px)`,
                              display: 'table',
                              tableLayout: 'fixed',
                            }}
                          >
                            {columnOrder.map(columnKey => renderTableCell(columnKey, reservation))}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            
            {pagination && (
              <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
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
                        <SelectItem value="1000">1000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="text-sm text-muted-foreground font-medium">
                    Showing {reservations.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + reservations.length} of {pagination.totalRecords.toLocaleString()} reservations
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPaginationPages(currentPage, pagination.totalPages).map((page, idx) => (
                    page === '...' ? (
                      <Button key={`ellipsis-${idx}`} variant="ghost" size="icon" disabled className="h-8 w-8 p-0 text-sm">
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
                  
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))} disabled={currentPage === pagination.totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(pagination.totalPages)} disabled={currentPage === pagination.totalPages}>
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingReservation ? 'Edit IP Reservation' : 'Add IP Reservation'}</DialogTitle>
              <DialogDescription>
                {editingReservation ? 'Update the IP reservation details below' : 'Fill in the details to create a new IP reservation'}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-1">
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Network className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Reservation Details</h3>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="radiusUserId">RADIUS User</Label>
                    <Combobox
                      options={(() => {
                        const userOptions = users.map((user) => {
                          const nameParts = []
                          if (user.firstname) nameParts.push(user.firstname)
                          if (user.lastname) nameParts.push(user.lastname)
                          const fullName = nameParts.length > 0 ? ` (${nameParts.join(' ')})` : ''
                          
                          const details = []
                          if (user.profileName) details.push(user.profileName)
                          if (user.zoneName) details.push(user.zoneName)
                          if (user.groupName) details.push(user.groupName)
                          const detailsStr = details.length > 0 ? ` - ${details.join(' | ')}` : ''
                          
                          return {
                            value: user.id?.toString() || '',
                            label: `${user.username}${fullName}${detailsStr}`,
                            searchKey: user.username
                          }
                        })

                        // If editing and the selected user isn't in the current search results, add it
                        if (editingReservation?.radiusUserId && editingReservation.username) {
                          const isUserInList = userOptions.some(opt => opt.value === editingReservation.radiusUserId?.toString())
                          if (!isUserInList) {
                            const nameParts = []
                            if (editingReservation.firstname) nameParts.push(editingReservation.firstname)
                            if (editingReservation.lastname) nameParts.push(editingReservation.lastname)
                            const fullName = nameParts.length > 0 ? ` (${nameParts.join(' ')})` : ''
                            
                            const details = []
                            if (editingReservation.profileName) details.push(editingReservation.profileName)
                            if (editingReservation.zoneName) details.push(editingReservation.zoneName)
                            if (editingReservation.groupName) details.push(editingReservation.groupName)
                            const detailsStr = details.length > 0 ? ` - ${details.join(' | ')}` : ''
                            
                            userOptions.unshift({
                              value: editingReservation.radiusUserId.toString(),
                              label: `${editingReservation.username}${fullName}${detailsStr}`,
                              searchKey: editingReservation.username
                            })
                          }
                        }

                        return userOptions
                      })()}
                      value={formData.radiusUserId}
                      onValueChange={(value) => {
                        setFormData({ ...formData, radiusUserId: value })
                        if (formErrors.radiusUserId) {
                          setFormErrors({ ...formErrors, radiusUserId: undefined })
                        }
                      }}
                      placeholder="Select user (optional)"
                      searchPlaceholder="Search username..."
                      emptyText={isLoadingUsers ? "Loading..." : "No users found"}
                      modal={true}
                      onSearchChange={setUserSearch}
                    />
                    {formErrors.radiusUserId && (
                      <p className="text-sm text-destructive">{formErrors.radiusUserId}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ipAddress">IP Address <span className="text-destructive">*</span></Label>
                    <Input
                      id="ipAddress"
                      value={formData.ipAddress}
                      onChange={(e) => {
                        setFormData({ ...formData, ipAddress: e.target.value })
                        if (formErrors.ipAddress) {
                          setFormErrors({ ...formErrors, ipAddress: undefined })
                        }
                      }}
                      placeholder="e.g., 192.168.1.100"
                      className={formErrors.ipAddress ? 'border-destructive' : ''}
                    />
                    {formErrors.ipAddress && (
                      <p className="text-sm text-destructive">{formErrors.ipAddress}</p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="e.g., Office router"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formData.ipAddress || createMutation.isPending || updateMutation.isPending}
              >
                {editingReservation ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the IP reservation to trash. You can restore it later from the trash view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore IP Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the IP reservation and make it available again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Columns Dialog */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Columns to Default?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column widths, order, and visibility to their default settings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetColumns}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
