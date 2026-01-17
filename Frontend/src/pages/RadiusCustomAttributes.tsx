import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, List } from 'lucide-react'
import { radiusCustomAttributeApi, type RadiusCustomAttribute, type CreateRadiusCustomAttributeRequest, type UpdateRadiusCustomAttributeRequest } from '@/api/radiusCustomAttributeApi'
import { radiusUserApi } from '@/api/radiusUserApi'
import { radiusProfileApi } from '@/api/radiusProfileApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'
import { Card, CardContent } from '@/components/ui/card'

export default function RadiusCustomAttributes() {
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

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<RadiusCustomAttribute | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [attributeToRestore, setAttributeToRestore] = useState<number | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<number[]>([])
  const [showTrash, setShowTrash] = useState(false)

  const DEFAULT_COLUMN_VISIBILITY = {
    attributeName: true,
    attributeValue: true,
    linkType: true,
    linkedTo: true,
    enabled: true,
    createdAt: false,
    updatedAt: false,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    checkbox: 20,
    attributeName: 200,
    attributeValue: 180,
    linkType: 120,
    linkedTo: 200,
    enabled: 100,
    createdAt: 160,
    updatedAt: 160,
    actions: 120,
  }

  const DEFAULT_COLUMN_ORDER = [
    'checkbox',
    'attributeName',
    'attributeValue',
    'linkType',
    'linkedTo',
    'enabled',
    'createdAt',
    'updatedAt',
    'actions',
  ]

  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const [formData, setFormData] = useState<CreateRadiusCustomAttributeRequest>({
    attributeName: '',
    attributeValue: '',
    linkType: 'profile',
    enabled: true,
  })

  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('radius-custom-attributes')
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

  useEffect(() => {
    if (!preferencesLoaded) return

    const savePreferences = async () => {
      try {
        await tablePreferenceApi.savePreference({
          tableName: 'radius-custom-attributes',
          columnWidths: JSON.stringify(columnWidths),
          columnOrder: JSON.stringify(columnOrder),
          columnVisibility: JSON.stringify(columnVisibility),
          sortField: sortField || undefined,
          sortDirection: sortDirection,
        })
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
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['radiusCustomAttributes', currentWorkspaceId, currentPage, pageSize, searchQuery, sortField, sortDirection, showTrash],
    queryFn: () => radiusCustomAttributeApi.getAll({
      page: currentPage,
      pageSize,
      search: searchQuery,
      sortField,
      sortDirection,
      includeDeleted: showTrash,
    }),
  })

  const { data: usersData } = useQuery({
    queryKey: ['radiusUsers', 1, 1000],
    queryFn: () => radiusUserApi.getAll(1, 1000),
  })

  const { data: profilesData } = useQuery({
    queryKey: ['radiusProfiles', 1, 1000],
    queryFn: () => radiusProfileApi.getAll(1, 1000),
  })

  const users = usersData?.data || []
  const profiles = profilesData?.data || []
  const attributes = data?.data || []
  const pagination = data?.pagination

  const rowVirtualizer = useVirtualizer({
    count: attributes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  const createMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute created successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRadiusCustomAttributeRequest }) =>
      radiusCustomAttributeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute updated successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute deleted successfully')
      setDeleteDialogOpen(false)
      setAttributeToDelete(null)
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.restore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute restored successfully')
      setRestoreDialogOpen(false)
      setAttributeToRestore(null)
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Selected custom attributes deleted successfully')
      setSelectedAttributeIds([])
      setBulkDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const resetForm = () => {
    setFormData({
      attributeName: '',
      attributeValue: '',
      linkType: 'profile',
      enabled: true,
    })
    setEditingAttribute(null)
  }

  const handleOpenDialog = (attribute?: RadiusCustomAttribute) => {
    if (attribute) {
      setEditingAttribute(attribute)
      setFormData({
        attributeName: attribute.attributeName,
        attributeValue: attribute.attributeValue,
        linkType: attribute.linkType,
        radiusUserId: attribute.radiusUserId,
        radiusProfileId: attribute.radiusProfileId,
        enabled: attribute.enabled,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = () => {
    if (editingAttribute) {
      updateMutation.mutate({ id: editingAttribute.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAttributeIds(attributes.map(a => a.id))
    } else {
      setSelectedAttributeIds([])
    }
  }

  const handleSelectAttribute = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedAttributeIds([...selectedAttributeIds, id])
    } else {
      setSelectedAttributeIds(selectedAttributeIds.filter(aid => aid !== id))
    }
  }

  const handleDelete = (id: number) => {
    setAttributeToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleRestore = (id: number) => {
    setAttributeToRestore(id)
    setRestoreDialogOpen(true)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const handleResetColumns = () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    setSortField('')
    setSortDirection('asc')
    setResetColumnsDialogOpen(false)
    toast.success('Column settings reset successfully')
  }

  const handleResizeStart = useCallback((e: React.MouseEvent, column: string) => {
    setResizing(column)
    e.preventDefault()
  }, [])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizing) return
    
    const table = document.querySelector('.custom-attributes-table')
    if (!table) return

    const th = table.querySelector(`th[data-column="${resizing}"]`) as HTMLElement
    if (!th) return

    const startX = th.getBoundingClientRect().left
    const width = Math.max(50, e.clientX - startX)
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing]: width
    }))
  }, [resizing])

  const handleResizeEnd = useCallback(() => {
    setResizing(null)
  }, [])

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizing, handleResizeMove, handleResizeEnd])

  const handleColumnDragStart = useCallback((e: React.DragEvent, column: string) => {
    if (column === 'checkbox' || column === 'actions') return
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, column: string) => {
    if (!draggingColumn || column === 'checkbox' || column === 'actions') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggingColumn !== column) {
      setDragOverColumn(column)
    }
  }, [draggingColumn])

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    
    if (!draggingColumn || draggingColumn === targetColumn || targetColumn === 'checkbox' || targetColumn === 'actions') {
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const renderColumnHeader = (columnKey: string) => {
    const columnConfig: Record<string, { label: string | JSX.Element, sortKey?: string, draggable?: boolean }> = {
      checkbox: { label: <Checkbox checked={selectedAttributeIds.length === attributes.length && attributes.length > 0} onCheckedChange={handleSelectAll} />, draggable: false },
      attributeName: { label: 'Attribute Name', sortKey: 'attributename' },
      attributeValue: { label: 'Value', sortKey: 'attributevalue' },
      linkType: { label: 'Link Type', sortKey: 'linktype' },
      linkedTo: { label: 'Linked To' },
      enabled: { label: 'Status', sortKey: 'enabled' },
      createdAt: { label: 'Created', sortKey: 'createdat' },
      updatedAt: { label: 'Updated', sortKey: 'updatedat' },
      actions: { label: 'Actions', draggable: false },
    }

    const config = columnConfig[columnKey]
    if (!config) return null

    const isDraggable = config.draggable !== false
    const width = columnWidths[columnKey as keyof typeof columnWidths] || 150

    return (
      <TableHead
        key={columnKey}
        data-column={columnKey}
        className={`h-12 px-4 relative ${draggingColumn === columnKey ? 'opacity-50' : ''} ${dragOverColumn === columnKey ? 'border-l-2 border-primary' : ''}`}
        style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
        draggable={isDraggable}
        onDragStart={(e) => handleColumnDragStart(e, columnKey)}
        onDragOver={(e) => handleColumnDragOver(e, columnKey)}
        onDrop={(e) => handleColumnDrop(e, columnKey)}
        onDragEnd={handleColumnDragEnd}
      >
        <div className="flex items-center justify-between">
          {config.sortKey ? (
            <Button variant="ghost" onClick={() => handleSort(config.sortKey!)} className="h-8 p-0 hover:bg-transparent">
              <span>{config.label}</span>
              {getSortIcon(config.sortKey)}
            </Button>
          ) : (
            <span>{config.label}</span>
          )}
          {columnKey !== 'checkbox' && columnKey !== 'actions' && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50"
              onMouseDown={(e) => handleResizeStart(e, columnKey)}
            />
          )}
        </div>
      </TableHead>
    )
  }

  const renderTableCell = (attribute: RadiusCustomAttribute, columnKey: string) => {
    const width = columnWidths[columnKey as keyof typeof columnWidths] || 150
    const baseStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

    switch (columnKey) {
      case 'checkbox':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Checkbox
              checked={selectedAttributeIds.includes(attribute.id)}
              onCheckedChange={(checked) => handleSelectAttribute(attribute.id, checked as boolean)}
            />
          </TableCell>
        )
      case 'attributeName':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-medium" style={baseStyle}>
            {attribute.attributeName}
          </TableCell>
        )
      case 'attributeValue':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {attribute.attributeValue}
          </TableCell>
        )
      case 'linkType':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={attribute.linkType === 'user' ? 'default' : 'outline'}>
              {attribute.linkType}
            </Badge>
          </TableCell>
        )
      case 'linkedTo':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {attribute.linkType === 'user' ? attribute.radiusUsername : attribute.radiusProfileName}
          </TableCell>
        )
      case 'enabled':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={attribute.enabled ? 'success' : 'secondary'}>
              {attribute.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </TableCell>
        )
      case 'createdAt':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {formatDate(attribute.createdAt)}
          </TableCell>
        )
      case 'updatedAt':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {formatDate(attribute.updatedAt)}
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right" style={baseStyle}>
            <div className="flex justify-end gap-2">
              {!showTrash ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(attribute)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(attribute.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleRestore(attribute.id)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
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
          <h1 className="text-2xl font-bold">Custom Attributes</h1>
          <p className="text-sm text-muted-foreground">Manage custom RADIUS attributes for users and profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
            <TabsList>
              <TabsTrigger value="active">
                <List className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="trash">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search attributes..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => refetch()} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Toggle columns">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-[500px] overflow-y-auto">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={Object.values(columnVisibility).every(v => v)}
                  onCheckedChange={(checked) => {
                    const newVisibility = Object.keys(columnVisibility).reduce((acc, key) => ({
                      ...acc,
                      [key]: checked
                    }), {} as typeof columnVisibility)
                    setColumnVisibility(newVisibility)
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className="font-semibold"
                >
                  {Object.values(columnVisibility).every(v => v) ? 'Hide All' : 'Show All'}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {Object.entries(columnVisibility).map(([key, value]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={value}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, [key]: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setResetColumnsDialogOpen(true)
                  }}
                >
                  Reset to Default
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Attribute
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="overflow-auto" style={{ height: 'calc(100vh - 280px)' }}>
              <Table className="custom-attributes-table">
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                    {columnOrder
                      .filter(col => col === 'checkbox' || col === 'actions' || columnVisibility[col as keyof typeof columnVisibility])
                      .map(col => renderColumnHeader(col))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4 w-[20px]"><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell className="h-12 px-4 w-[200px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="h-12 px-4 w-[200px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="h-12 px-4 w-[120px]">
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
          ) : !isLoading && attributes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" style={{ height: 'calc(100vh - 280px)' }}>
              <div className="rounded-full bg-muted p-6 mb-4">
                {showTrash ? (
                  <Archive className="h-12 w-12 text-muted-foreground" />
                ) : (
                  <Settings className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {showTrash ? 'No Deleted Attributes' : 'No Custom Attributes Yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {showTrash
                  ? 'No custom attributes have been deleted'
                  : 'Get started by adding your first custom RADIUS attribute'}
              </p>
              {!showTrash && (
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Attribute
                </Button>
              )}
            </div>
          ) : attributes.length > 0 ? (
            <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 280px)' }}>
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
              <Table className="custom-attributes-table">
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                    {columnOrder
                      .filter(col => col === 'checkbox' || col === 'actions' || columnVisibility[col as keyof typeof columnVisibility])
                      .map(col => renderColumnHeader(col))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const attribute = attributes[virtualRow.index]
                    return (
                      <TableRow
                        key={attribute.id}
                        data-index={virtualRow.index}
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start - virtualRow.index * virtualRow.size}px)`,
                        }}
                      >
                        {columnOrder
                          .filter(col => col === 'checkbox' || col === 'actions' || columnVisibility[col as keyof typeof columnVisibility])
                          .map(col => renderTableCell(attribute, col))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalCount)} of {pagination.totalCount} results
          </div>
          <div className="flex items-center gap-2">
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-25">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / page</SelectItem>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {getPaginationPages(currentPage, pagination.totalPages).map((page, index) => (
                typeof page === 'number' ? (
                  <Button
                    key={index}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="min-w-[2.5rem]"
                  >
                    {page}
                  </Button>
                ) : (
                  <span key={index} className="flex items-center px-2">
                    ...
                  </span>
                )
              ))}

              <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === pagination.totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(pagination.totalPages)} disabled={currentPage === pagination.totalPages}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAttribute ? 'Edit' : 'Create'} Custom Attribute</DialogTitle>
            <DialogDescription>
              {editingAttribute ? 'Update the custom attribute details' : 'Add a new custom RADIUS attribute'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attributeName">Attribute Name *</Label>
                <Input
                  id="attributeName"
                  value={formData.attributeName}
                  onChange={(e) => setFormData({ ...formData, attributeName: e.target.value })}
                  placeholder="e.g., Alc-SLA-Prof-Str"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attributeValue">Attribute Value *</Label>
                <Input
                  id="attributeValue"
                  value={formData.attributeValue}
                  onChange={(e) => setFormData({ ...formData, attributeValue: e.target.value })}
                  placeholder="e.g., P1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkType">Link Type *</Label>
              <Select
                value={formData.linkType}
                onValueChange={(v: 'user' | 'profile') => {
                  setFormData({ 
                    ...formData, 
                    linkType: v,
                    radiusUserId: undefined,
                    radiusProfileId: undefined,
                  })
                }}
              >
                <SelectTrigger id="linkType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.linkType === 'user' ? (
              <div className="space-y-2">
                <Label htmlFor="radiusUserId">Radius User *</Label>
                <Combobox
                  options={users.map((u) => ({
                    value: u.id?.toString() || '',
                    label: u.username || `User ${u.id}`,
                  }))}
                  value={formData.radiusUserId?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, radiusUserId: parseInt(v) })}
                  placeholder="Select user..."
                  searchPlaceholder="Search users..."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="radiusProfileId">Radius Profile *</Label>
                <Combobox
                  options={profiles.map((p) => ({
                    value: p.id?.toString() || '',
                    label: p.name || `Profile ${p.id}`,
                  }))}
                  value={formData.radiusProfileId?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, radiusProfileId: parseInt(v) })}
                  placeholder="Select profile..."
                  searchPlaceholder="Search profiles..."
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingAttribute ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the custom attribute. This action can be undone by restoring the attribute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => attributeToDelete && deleteMutation.mutate(attributeToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Attribute?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the custom attribute and make it active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => attributeToRestore && restoreMutation.mutate(attributeToRestore)}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedAttributeIds.length} attribute{selectedAttributeIds.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all selected custom attributes. This action can be undone by restoring them individually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedAttributeIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Column Settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column visibility, widths, order, and sorting to their default values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetColumns}>
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Bar */}
      {selectedAttributeIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="font-medium">
            {selectedAttributeIds.length.toLocaleString()} attribute{selectedAttributeIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="h-4 w-px bg-primary-foreground/20" />
          
          {showTrash ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => {
                // Bulk restore - to be implemented if needed
                toast.info('Bulk restore not yet implemented')
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setSelectedAttributeIds([])}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  )
}
