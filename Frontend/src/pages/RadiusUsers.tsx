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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText, List, Users, Settings } from 'lucide-react'
import { radiusUserApi, type RadiusUser } from '@/api/radiusUserApi'
import { radiusProfileApi } from '@/api/radiusProfileApi'
import { radiusTagApi } from '@/api/radiusTagApi'
import { zoneApi, type Zone } from '@/services/zoneApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { workspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'
import { settingsApi } from '@/api/settingsApi'

export default function RadiusUsers() {
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
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection])

  // User state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<RadiusUser | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [userToRestore, setUserToRestore] = useState<number | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  
  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    username: true,
    name: true,
    email: true,
    phone: true,
    city: false,
    profile: true,
    status: true,
    balance: true,
    loanBalance: false,
    expiration: true,
    lastOnline: false,
    onlineStatus: false,
    remainingDays: false,
    debtDays: false,
    staticIp: false,
    company: false,
    address: false,
    contractId: false,
    notes: false,
    gpsLat: false,
    gpsLng: false,
    simultaneousSessions: false,
    createdAt: false,
    updatedAt: false,
    tags: true,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    checkbox: 20,
    username: 150,
    name: 180,
    email: 200,
    phone: 140,
    city: 140,
    profile: 140,
    status: 100,
    balance: 120,
    loanBalance: 120,
    expiration: 120,
    lastOnline: 120,
    onlineStatus: 100,
    remainingDays: 120,
    debtDays: 100,
    staticIp: 140,
    company: 140,
    address: 160,
    contractId: 120,
    notes: 200,
    gpsLat: 120,
    gpsLng: 120,
    simultaneousSessions: 100,
    createdAt: 160,
    updatedAt: 160,
    tags: 200,
    actions: 120,
  }

  const DEFAULT_COLUMN_ORDER = [
    'checkbox',
    'username',
    'name',
    'email',
    'phone',
    'city',
    'profile',
    'status',
    'balance',
    'loanBalance',
    'expiration',
    'lastOnline',
    'onlineStatus',
    'remainingDays',
    'debtDays',
    'staticIp',
    'company',
    'address',
    'contractId',
    'notes',
    'gpsLat',
    'gpsLng',
    'simultaneousSessions',
    'createdAt',
    'updatedAt',
    'tags',
    'actions',
  ]
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)

  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)

  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)

  const [resizing, setResizing] = useState<string | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const [showTrash, setShowTrash] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    city: '',
    profileId: '',
    expiration: '',
    enabled: true,
    staticIp: '',
    company: '',
    address: '',
    contractId: '',
    notes: '',
    gpsLat: '',
    gpsLng: '',
    simultaneousSessions: '1',
    zoneId: '',
  })

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkRenewDialogOpen, setBulkRenewDialogOpen] = useState(false)
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false)

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع' : 'IQD'
      case 'USD':
      default:
        return '$'
    }
  }

  // Helper to format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const { data: generalSettings } = useQuery({
    queryKey: ['general-settings', currentWorkspaceId],
    queryFn: () => settingsApi.getGeneralSettings(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: usersData, isLoading, isFetching } = useQuery({
    queryKey: ['radius-users', currentWorkspaceId, currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash 
      ? radiusUserApi.getTrash(currentPage, pageSize)
      : radiusUserApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
    enabled: !!currentWorkspaceId,
  })

  const { data: profilesData } = useQuery({
    queryKey: ['radius-profiles'],
    queryFn: () => radiusProfileApi.getAll(1, 999999),
    enabled: !!currentWorkspaceId,
  })

  const { data: tagsData } = useQuery({
    queryKey: ['radius-tags'],
    queryFn: () => radiusTagApi.getAll(false),
    enabled: !!currentWorkspaceId,
  })

  const { data: zonesData } = useQuery({
    queryKey: ['zones', currentWorkspaceId],
    queryFn: () => zoneApi.getZones(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const users = useMemo(() => usersData?.data || [], [usersData?.data])
  const pagination = usersData?.pagination
  const profiles = useMemo(() => profilesData?.data || [], [profilesData?.data])
  const tags = useMemo(() => tagsData || [], [tagsData])
  const zones = useMemo(() => zonesData || [], [zonesData])

  // Track if preferences have been loaded
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  // Load table preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('radius-users')
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
        // Silently fail if preferences don't exist
        console.log('No saved preferences found', error)
      } finally {
        setPreferencesLoaded(true)
      }
    }

    loadPreferences()
  }, [])

  // Auto-save preferences when they change (but not on initial load)
  useEffect(() => {
    if (!preferencesLoaded) return // Don't save until preferences are loaded

    const savePreferences = async () => {
      try {
        await tablePreferenceApi.savePreference({
          tableName: 'radius-users',
          columnWidths: JSON.stringify(columnWidths),
          columnOrder: JSON.stringify(columnOrder),
          columnVisibility: JSON.stringify(columnVisibility),
          sortField: sortField || undefined,
          sortDirection: sortDirection,
        })
        console.log('Table preferences saved successfully')
      } catch (error) {
        // Silently fail - don't show error to user for preference saves
        console.error('Failed to save table preferences:', error)
      }
    }

    // Debounce the save to avoid too many API calls
    const timeoutId = setTimeout(savePreferences, 1000)
    return () => clearTimeout(timeoutId)
  }, [columnWidths, columnOrder, columnVisibility, sortField, sortDirection, currentWorkspaceId, preferencesLoaded])

  // Virtual scrolling - optimized for large datasets
  const rowVirtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approximate row height in pixels
    overscan: 2, // Reduced overscan for better performance with large datasets
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => radiusUserApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusUserApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => radiusUserApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success('User deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete user')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => radiusUserApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success('User restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore user')
    },
  })

  const assignTagsMutation = useMutation({
    mutationFn: ({ userId, tagIds }: { userId: number; tagIds: number[] }) =>
      radiusUserApi.assignTags(userId, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to assign tags')
    },
  })

  // Bulk operations handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(users.map(u => u.id!))
    } else {
      setSelectedUserIds([])
    }
  }

  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUserIds(prev => [...prev, userId])
    } else {
      setSelectedUserIds(prev => prev.filter(id => id !== userId))
    }
  }

  const handleBulkDelete = async () => {
    setBulkActionLoading(true)
    try {
      const result = await radiusUserApi.bulkDelete(selectedUserIds)
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success(result.message || `Successfully deleted ${result.count} user(s)`)
      setSelectedUserIds([])
      setBulkDeleteDialogOpen(false)
    } catch (error) {
      toast.error(formatApiError(error) || 'Failed to delete users')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkRenew = async () => {
    setBulkActionLoading(true)
    try {
      const result = await radiusUserApi.bulkRenew(selectedUserIds)
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success(result.message || `Successfully renewed ${result.count} user(s) for 30 days`)
      setSelectedUserIds([])
      setBulkRenewDialogOpen(false)
    } catch (error) {
      toast.error(formatApiError(error) || 'Failed to renew users')
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkRestore = async () => {
    setBulkActionLoading(true)
    try {
      const result = await radiusUserApi.bulkRestore(selectedUserIds)
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      toast.success(result.message || `Successfully restored ${result.count} user(s)`)
      setSelectedUserIds([])
      setBulkRestoreDialogOpen(false)
    } catch (error) {
      toast.error(formatApiError(error) || 'Failed to restore users')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Handlers
  const handleOpenDialog = (user?: RadiusUser) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        city: user.city || '',
        profileId: user.profileId?.toString() || '',
        expiration: user.expiration ? user.expiration.substring(0, 10) : '',
        enabled: user.enabled,
        staticIp: user.staticIp || '',
        company: user.company || '',
        address: user.address || '',
        contractId: user.contractId || '',
        notes: user.notes || '',
        gpsLat: user.gpsLat || '',
        gpsLng: user.gpsLng || '',
        simultaneousSessions: user.simultaneousSessions?.toString() || '1',
        zoneId: user.zoneId?.toString() || '',
      })
      setSelectedTagIds(user.tags?.map(t => t.id) || [])
    } else {
      setEditingUser(null)
      setFormData({
        username: '',
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        city: '',
        profileId: '',
        expiration: '',
        enabled: true,
        staticIp: '',
        company: '',
        address: '',
        contractId: '',
        notes: '',
        gpsLat: '',
        gpsLng: '',
        simultaneousSessions: '1',
        zoneId: '',
      })
      setSelectedTagIds([])
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
  }

  const handleSave = async () => {
    if (!formData.username) {
      toast.error('Username is required')
      return
    }

    const data = {
      username: formData.username,
      firstname: formData.firstname || undefined,
      lastname: formData.lastname || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      city: formData.city || undefined,
      profileId: formData.profileId ? parseInt(formData.profileId) : undefined,
      expiration: formData.expiration ? new Date(formData.expiration).toISOString() : undefined,
      enabled: formData.enabled,
      staticIp: formData.staticIp || undefined,
      company: formData.company || undefined,
      address: formData.address || undefined,
      contractId: formData.contractId || undefined,
      notes: formData.notes || undefined,
      gpsLat: formData.gpsLat || undefined,
      gpsLng: formData.gpsLng || undefined,
      simultaneousSessions: parseInt(formData.simultaneousSessions) || 1,
      zoneId: formData.zoneId ? parseInt(formData.zoneId) : undefined,
    }

    try {
      if (editingUser && editingUser.id) {
        await updateMutation.mutateAsync({ id: editingUser.id, data })
        // Assign tags after updating user
        await assignTagsMutation.mutateAsync({ userId: editingUser.id, tagIds: selectedTagIds })
        toast.success('User updated successfully')
      } else {
        const newUser = await createMutation.mutateAsync(data)
        // Assign tags after creating user
        if (newUser.id) {
          await assignTagsMutation.mutateAsync({ userId: newUser.id, tagIds: selectedTagIds })
        }
        toast.success('User created successfully')
      }
      handleCloseDialog()
    } catch (error) {
      // Error already handled by mutations
    }
  }

  const handleDelete = (id?: number) => {
    if (id) {
      setUserToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  const handleRestore = (userId: number) => {
    setUserToRestore(userId)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (userToRestore) {
      restoreMutation.mutate(userToRestore)
      setRestoreDialogOpen(false)
      setUserToRestore(null)
    }
  }

  const handleResetColumns = () => {
    setResetColumnsDialogOpen(true)
  }

  const confirmResetColumns = async () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    
    // Delete saved preferences from backend
    try {
      await tablePreferenceApi.deletePreference('radius-users')
      toast.success('Table columns reset to defaults')
    } catch (error) {
      console.error('Failed to delete preferences:', error)
      toast.error('Columns reset but failed to clear saved preferences')
    }
    
    setResetColumnsDialogOpen(false)
  }

  const handleSort = useCallback((field: string) => {
    // Prevent sorting if we just finished resizing
    if (resizing) return
    
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
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
  const handleColumnDragStart = useCallback((e: React.DragEvent, column: string) => {
    if (column === 'checkbox' || column === 'actions') return // Don't allow dragging checkbox or actions columns
    setDraggingColumn(column)
    e.dataTransfer.effectAllowed = 'move'
    // Add a subtle drag image
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
      dragImage.style.opacity = '0.5'
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
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
      
      // Remove dragged column
      newOrder.splice(dragIndex, 1)
      // Insert at new position
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

  // Generate pagination page numbers
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7 // Maximum number of page buttons to show
    
    if (total <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      // Show pages around current page
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      // Always show last page
      pages.push(total)
    }
    
    return pages
  }, [])

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const blob = await radiusUserApi.exportToCsv(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `radius_users_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('CSV exported successfully')
    } catch (error) {
      toast.error('Failed to export CSV')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const blob = await radiusUserApi.exportToExcel(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `radius_users_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel exported successfully')
    } catch (error) {
      toast.error('Failed to export Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1) // Reset to first page on new search
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1) // Reset to first page
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  // Helper function to render column header with drag and drop
  const renderColumnHeader = (columnKey: string) => {
    const columnConfig: Record<string, { label: string | JSX.Element, sortKey?: string, align?: string, draggable?: boolean }> = {
      checkbox: { label: <Checkbox checked={selectedUserIds.length === users.length && users.length > 0} onCheckedChange={handleSelectAll} />, draggable: false },
      username: { label: t('radiusUsers.username'), sortKey: 'username' },
      name: { label: t('radiusUsers.name'), sortKey: 'name' },
      email: { label: t('radiusUsers.email'), sortKey: 'email' },
      phone: { label: t('radiusUsers.phone'), sortKey: 'phone' },
      city: { label: 'City', sortKey: 'city' },
      profile: { label: t('radiusUsers.profile'), sortKey: 'profile' },
      status: { label: t('radiusUsers.status'), sortKey: 'enabled' },
      balance: { label: t('radiusUsers.balance'), sortKey: 'balance', align: 'right' },
      loanBalance: { label: 'Loan Balance', sortKey: 'loanBalance', align: 'right' },
      expiration: { label: t('radiusUsers.expiration'), sortKey: 'expiration' },
      lastOnline: { label: 'Last Online', sortKey: 'lastOnline' },
      onlineStatus: { label: 'Online', sortKey: 'onlineStatus' },
      remainingDays: { label: 'Remaining Days', sortKey: 'remainingDays', align: 'right' },
      debtDays: { label: 'Debt Days', sortKey: 'debtDays', align: 'right' },
      staticIp: { label: 'Static IP' },
      company: { label: 'Company' },
      address: { label: 'Address' },
      contractId: { label: 'Contract ID' },
      notes: { label: 'Notes', sortKey: 'notes' },
      gpsLat: { label: 'Latitude', sortKey: 'gpsLat' },
      gpsLng: { label: 'Longitude', sortKey: 'gpsLng' },
      simultaneousSessions: { label: 'Sessions', align: 'center' },
      createdAt: { label: 'Created At', sortKey: 'createdAt' },
      updatedAt: { label: 'Updated At', sortKey: 'updatedAt' },
      tags: { label: 'Tags' },
      actions: { label: t('common.actions'), draggable: false },
    }

    const config = columnConfig[columnKey]
    if (!config) return null

    // Check if column is visible
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'checkbox' && columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const isDraggable = config.draggable !== false && columnKey !== 'checkbox' && columnKey !== 'actions'
    const isSortable = !!config.sortKey
    const isDragging = draggingColumn === columnKey
    const isDragOver = dragOverColumn === columnKey

    const baseClasses = "h-12 px-4 font-semibold whitespace-nowrap select-none relative"
    const alignmentClass = config.align === 'right' ? 'text-right' : config.align === 'center' ? 'text-center' : ''
    const sortableClass = isSortable ? 'cursor-pointer' : ''
    const dragClasses = isDragging ? 'opacity-50' : isDragOver ? 'bg-blue-100 dark:bg-blue-900' : ''
    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-muted z-10' : ''
    
    return (
      <TableHead
        key={columnKey}
        className={`${baseClasses} ${alignmentClass} ${sortableClass} ${dragClasses} ${stickyClass}`}
        style={{ width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }}
        onClick={isSortable ? () => handleSort(config.sortKey!) : undefined}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleColumnDragStart(e, columnKey) : undefined}
        onDragOver={isDraggable ? (e) => handleColumnDragOver(e, columnKey) : undefined}
        onDrop={isDraggable ? (e) => handleColumnDrop(e, columnKey) : undefined}
        onDragEnd={isDraggable ? handleColumnDragEnd : undefined}
      >
        {typeof config.label === 'string' ? config.label : config.label}
        {isSortable && getSortIcon(config.sortKey!)}
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

  // Helper function to render table cell based on column order
  const renderTableCell = (columnKey: string, user: RadiusUser) => {
    // Check if column is visible
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'checkbox' && columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-background z-10' : ''
    const baseStyle = { width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }

    switch (columnKey) {
      case 'checkbox':
        const churnDays = generalSettings?.churnDays || 20
        let statusColor = 'bg-green-500' // Default: active
        
        if (user.expiration) {
          const expirationDate = new Date(user.expiration)
          const today = new Date()
          today.setHours(0, 0, 0, 0) // Normalize to start of day
          expirationDate.setHours(0, 0, 0, 0)
          
          if (expirationDate >= today) {
            // Expiration is today or future - GREEN (active)
            statusColor = 'bg-green-500'
          } else {
            // Expired - calculate days since expiration
            const daysSinceExpiration = Math.floor((today.getTime() - expirationDate.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysSinceExpiration > churnDays) {
              // Expired more than churnDays ago - RED (churned)
              statusColor = 'bg-red-500'
            } else {
              // Expired but less than churnDays - YELLOW (recently expired)
              statusColor = 'bg-yellow-500'
            }
          }
        }
        
        return (
          <TableCell key={columnKey} className="h-12 px-4 relative" style={baseStyle}>
            <div className={`absolute left-0 top-3 bottom-3 w-0.5 ${statusColor}`}></div>
            <Checkbox
              checked={selectedUserIds.includes(user.id!)}
              onCheckedChange={(checked) => handleSelectUser(user.id!, checked as boolean)}
            />
          </TableCell>
        )
      case 'username':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-medium" style={baseStyle}>{user.username}</TableCell>
        )
      case 'name':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.firstname} {user.lastname}</TableCell>
        )
      case 'email':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.email || '-'}</TableCell>
        )
      case 'phone':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.phone || '-'}</TableCell>
        )
      case 'city':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.city || '-'}</TableCell>
        )
      case 'profile':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.profileName || '-'}</TableCell>
        )
      case 'status':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={user.enabled ? 'success' : 'destructive'}>
              {user.enabled ? t('radiusUsers.active') : t('radiusUsers.inactive')}
            </Badge>
          </TableCell>
        )
      case 'balance':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right" style={baseStyle}>
            {currencySymbol} {formatNumber(user.balance || 0)}
          </TableCell>
        )
      case 'loanBalance':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right" style={baseStyle}>
            {currencySymbol} {formatNumber(user.loanBalance || 0)}
          </TableCell>
        )
      case 'expiration':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{formatDate(user.expiration)}</TableCell>
        )
      case 'lastOnline':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{formatDate(user.lastOnline)}</TableCell>
        )
      case 'onlineStatus':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={user.onlineStatus ? 'success' : 'secondary'}>
              {user.onlineStatus ? 'Online' : 'Offline'}
            </Badge>
          </TableCell>
        )
      case 'remainingDays':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right" style={baseStyle}>
            {user.remainingDays !== undefined ? user.remainingDays : '-'}
          </TableCell>
        )
      case 'debtDays':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right" style={baseStyle}>
            {user.debtDays !== undefined ? user.debtDays : '-'}
          </TableCell>
        )
      case 'staticIp':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.staticIp || '-'}</TableCell>
        )
      case 'company':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.company || '-'}</TableCell>
        )
      case 'address':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.address || '-'}</TableCell>
        )
      case 'contractId':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.contractId || '-'}</TableCell>
        )
      case 'notes':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <div className="max-w-xs truncate" title={user.notes || ''}>
              {user.notes || '-'}
            </div>
          </TableCell>
        )
      case 'gpsLat':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.gpsLat || '-'}</TableCell>
        )
      case 'gpsLng':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{user.gpsLng || '-'}</TableCell>
        )
      case 'simultaneousSessions':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-center" style={baseStyle}>
            {user.simultaneousSessions || 1}
          </TableCell>
        )
      case 'createdAt':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{formatDate(user.createdAt)}</TableCell>
        )
      case 'updatedAt':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>{formatDate(user.updatedAt)}</TableCell>
        )
      case 'tags':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {user.tags && user.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {user.tags.map(tag => (
                  <Badge key={tag.id} variant="outline" className="text-xs">
                    {tag.tagName}
                  </Badge>
                ))}
              </div>
            ) : '-'}
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 text-right ${stickyClass}`} style={baseStyle}>
            <div className="flex justify-end gap-2">
              {!showTrash ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleRestore(user.id!)}>
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
      {isExporting && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Exporting data...</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('radiusUsers.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('radiusUsers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
            <TabsList>
              <TabsTrigger value="active">
                <Users className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="trash">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder={t('radiusUsers.searchUsers')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })} 
              variant="outline" 
              size="icon"
              title={t('common.refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  disabled={isExporting}
                  title="Export data"
                >
                  {isExporting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={handleExportCsv}
                    disabled={isExporting}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Export as CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as Excel
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
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
                        setColumnVisibility({
                          username: checked,
                          name: checked,
                          email: checked,
                          phone: checked,
                          city: checked,
                          profile: checked,
                          status: checked,
                          balance: checked,
                          loanBalance: checked,
                          expiration: checked,
                          lastOnline: checked,
                          onlineStatus: checked,
                          remainingDays: checked,
                          debtDays: checked,
                          staticIp: checked,
                          company: checked,
                          address: checked,
                          contractId: checked,
                          notes: checked,
                          gpsLat: checked,
                          gpsLng: checked,
                          simultaneousSessions: checked,
                          createdAt: checked,
                          updatedAt: checked,
                          tags: checked,
                        })
                      }}
                      onSelect={(e) => e.preventDefault()}
                      className="font-semibold"
                    >
                      {Object.values(columnVisibility).every(v => v) ? 'Hide All' : 'Show All'}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.username}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, username: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.username')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.name}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.name')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.email}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, email: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.email')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.phone}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, phone: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.phone')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.profile}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, profile: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.profile')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.status}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.status')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.balance}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, balance: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.balance')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.expiration}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, expiration: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {t('radiusUsers.expiration')}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.city}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, city: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      City
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.loanBalance}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, loanBalance: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Loan Balance
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.lastOnline}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, lastOnline: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Last Online
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.onlineStatus}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, onlineStatus: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Online Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.remainingDays}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, remainingDays: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Remaining Days
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.debtDays}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, debtDays: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Debt Days
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.staticIp}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, staticIp: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Static IP
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.company}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, company: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Company
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.address}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, address: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Address
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.contractId}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, contractId: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Contract ID
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.notes}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, notes: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Notes
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.gpsLat}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, gpsLat: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Latitude
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.gpsLng}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, gpsLng: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Longitude
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.simultaneousSessions}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, simultaneousSessions: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Simultaneous Sessions
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.createdAt}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, createdAt: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Created At
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.updatedAt}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, updatedAt: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Updated At
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.tags}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, tags: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Tags
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
          <Button onClick={() => handleOpenDialog()} disabled={showTrash}>
            <Plus className="h-4 w-4 mr-2" />
            {t('radiusUsers.addUser')}
          </Button>
        </div>
      </div>

      <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
        <TabsContent value={showTrash ? 'trash' : 'active'} className="mt-0">
          <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoading ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 452px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-24" /></TableHead>
                    <TableHead className="h-12 px-4 w-[200px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="sticky right-0 bg-background h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[200px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="sticky right-0 bg-background h-12 px-4 w-[120px]">
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
          ) : !isLoading && usersData && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Users className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('radiusUsers.noUsersYet')}</h3>
              <p className="text-sm text-muted-foreground mb-6">{t('radiusUsers.getStarted')}</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('radiusUsers.addUser')}
              </Button>
            </div>
          ) : users.length > 0 ? (
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
                {/* Fixed Header */}
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                      {columnOrder.map(column => renderColumnHeader(column))}
                    </TableRow>
                  </TableHeader>
                
                {/* Scrollable Body */}
                <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const user = users[virtualRow.index]
                        return (
                          <TableRow 
                            key={user.id}
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
                          {columnOrder.map(column => renderTableCell(column, user))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
              </Table>
            </div>
          ) : null}
          
          {/* Pagination Controls - Always visible */}
          {pagination && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{t('radiusUsers.perPage')}</span>
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
                      <SelectItem value="999999">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground font-medium">
                  {t('radiusUsers.showing')} {formatNumber(users.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} {t('radiusUsers.to')} {formatNumber(((currentPage - 1) * pageSize) + users.length)} {t('radiusUsers.of')} {formatNumber(pagination.totalRecords)} {t('radiusUsers.users')}
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
        </TabsContent>
      </Tabs>

      {/* Floating Action Bar */}
      {selectedUserIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="font-medium">
            {selectedUserIds.length.toLocaleString()} user(s) selected
          </span>
          <div className="h-4 w-px bg-primary-foreground/20" />
          
          {showTrash ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => setBulkRestoreDialogOpen(true)}
              disabled={bulkActionLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setBulkRenewDialogOpen(true)}
                disabled={bulkActionLoading}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Renew
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={bulkActionLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setSelectedUserIds([])}
            disabled={bulkActionLoading}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUserIds.length} user(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkActionLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Renew Confirmation Dialog */}
      <AlertDialog open={bulkRenewDialogOpen} onOpenChange={setBulkRenewDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renew Multiple Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to renew {selectedUserIds.length} user(s) for 30 days? This will extend their expiration date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRenew}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Renewing...
                </>
              ) : (
                'Renew'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Restore Dialog */}
      <AlertDialog open={bulkRestoreDialogOpen} onOpenChange={setBulkRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Multiple Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore {selectedUserIds.length} user(s)? This will move them back to the active users list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRestore}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                'Restore'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Dialog */}
      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('radiusUsers.editUser') : t('radiusUsers.addUser')}</DialogTitle>
            <DialogDescription>
              {editingUser ? t('radiusUsers.updateDetails') : t('radiusUsers.fillDetails')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">{t('radiusUsers.username')} *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., john.doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t('radiusUsers.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">{t('radiusUsers.firstName')}</Label>
                <Input
                  id="firstname"
                  value={formData.firstname}
                  onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                  placeholder="e.g., John"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">{t('radiusUsers.lastName')}</Label>
                <Input
                  id="lastname"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  placeholder="e.g., Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('radiusUsers.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +1234567890"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">{t('radiusUsers.city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., New York"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profileId">{t('radiusUsers.profileId')}</Label>
                <Combobox
                  options={profiles.map((profile) => ({
                    value: profile.id?.toString() || '',
                    label: profile.name || ''
                  }))}
                  value={formData.profileId}
                  onValueChange={(value) => setFormData({ ...formData, profileId: value })}
                  placeholder={t('radiusUsers.selectProfile')}
                  searchPlaceholder={t('radiusUsers.searchProfile') || "Search profile..."}
                  emptyText={t('radiusUsers.noProfilesFound') || "No profiles found."}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="simultaneousSessions">{t('radiusUsers.sessions')}</Label>
                <Input
                  id="simultaneousSessions"
                  type="number"
                  value={formData.simultaneousSessions}
                  onChange={(e) => setFormData({ ...formData, simultaneousSessions: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zoneId">{t('radiusUsers.zone')}</Label>
                <Select
                  value={formData.zoneId}
                  onValueChange={(value) => setFormData({ ...formData, zoneId: value })}
                >
                  <SelectTrigger id="zoneId">
                    <SelectValue placeholder={t('radiusUsers.selectZone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('radiusUsers.noZone')}</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: zone.color || '#3b82f6' }}
                          />
                          <span>{zone.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiration">{t('radiusUsers.expirationDate')}</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={formData.expiration}
                  onChange={(e) => setFormData({ ...formData, expiration: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staticIp">{t('radiusUsers.staticIp')}</Label>
                <Input
                  id="staticIp"
                  value={formData.staticIp}
                  onChange={(e) => setFormData({ ...formData, staticIp: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">{t('radiusUsers.company')}</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">{t('radiusUsers.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g., 123 Main St"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contractId">{t('radiusUsers.contractId')}</Label>
              <Input
                id="contractId"
                value={formData.contractId}
                onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                placeholder="e.g., CONTRACT-2024-001"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Additional notes about the user"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="gpsLat">Latitude</Label>
                <Input
                  id="gpsLat"
                  value={formData.gpsLat}
                  onChange={(e) => setFormData({ ...formData, gpsLat: e.target.value })}
                  placeholder="e.g., 32.5202391247401"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gpsLng">Longitude</Label>
                <Input
                  id="gpsLng"
                  value={formData.gpsLng}
                  onChange={(e) => setFormData({ ...formData, gpsLng: e.target.value })}
                  placeholder="e.g., 45.79654097557068"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags available</p>
                ) : (
                  tags.filter(tag => tag.status === 'active').map((tag) => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`tag-${tag.id}`}
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTagIds([...selectedTagIds, tag.id])
                          } else {
                            setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label
                        htmlFor={`tag-${tag.id}`}
                        className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.title}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">{t('radiusUsers.enabled')}</Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('radiusUsers.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.username || createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? t('radiusUsers.update') : t('radiusUsers.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the user to trash. You can restore it later from the trash view.
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

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the user and make it available again.
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

      {/* Reset Columns Confirmation Dialog */}
      <AlertDialog open={resetColumnsDialogOpen} onOpenChange={setResetColumnsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Table Columns?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all column widths, order, and visibility to their default values. This action cannot be undone.
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
    </div>
  )
}

