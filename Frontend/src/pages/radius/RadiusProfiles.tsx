import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText, Package, Settings
} from 'lucide-react'
import { radiusProfileApi, type RadiusProfile } from '@/api/radiusProfileApi'
import { radiusCustomAttributeApi, type RadiusCustomAttribute, type CreateRadiusCustomAttributeRequest } from '@/api/radiusCustomAttributeApi'
import { customWalletApi } from '@/api/customWallets'
import { workspaceApi } from '@/lib/api'
import { formatApiError } from '@/utils/errorHandler'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { tablePreferenceApi } from '@/api/tablePreferenceApi'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function RadiusProfiles() {
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { i18n } = useTranslation()

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

  // Profile state
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<RadiusProfile | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [profileToRestore, setProfileToRestore] = useState<number | null>(null)
  const [resetColumnsDialogOpen, setResetColumnsDialogOpen] = useState(false)
  const [showTrash, setShowTrash] = useState(false)

  // Color and Icon picker state
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  // Default column settings
  const DEFAULT_COLUMN_VISIBILITY = {
    name: true,
    status: true,
    download: true,
    upload: true,
    price: true,
    pool: true,
    users: true,
  }

  const DEFAULT_COLUMN_WIDTHS = {
    checkbox: 50,
    name: 180,
    status: 100,
    download: 140,
    upload: 140,
    price: 120,
    pool: 140,
    users: 100,
    actions: 120,
  }

  const DEFAULT_COLUMN_ORDER = [
    'checkbox',
    'name',
    'status',
    'download',
    'upload',
    'price',
    'pool',
    'users',
    'actions',
  ]

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [resizing, setResizing] = useState<string | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  // Bulk selection and actions
  const [selectedProfileIds, setSelectedProfileIds] = useState<number[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const [profileFormData, setProfileFormData] = useState({
    name: '',
    downrate: '',
    uprate: '',
    price: '',
    monthly: '',
    pool: '',
    type: '',
    expirationAmount: '',
    expirationUnit: '0',
    enabled: true,
    burstEnabled: false,
    limitExpiration: false,
    color: '#3b82f6',
    icon: 'Package',
  })

  // Custom wallet configuration state
  const [enableCustomWallets, setEnableCustomWallets] = useState(false)
  const [selectedWallets, setSelectedWallets] = useState<Array<{ customWalletId: number; amount: string }>>([])

  // Custom attributes state
  const [customAttributes, setCustomAttributes] = useState<Array<{ id?: number; attributeName: string; attributeValue: string; enabled: boolean }>>([])

  // Fetch workspace currency
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  // Helper function to get currency symbol
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

  // Helper function to format numbers with thousand separators
  const formatNumber = (num: number | string) => {
    const numValue = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(numValue)) return ''
    return numValue.toLocaleString()
  }

  // Helper function to parse formatted number string
  const parseFormattedNumber = (str: string) => {
    return str.replace(/,/g, '')
  }

  // Fetch custom wallets
  const { data: customWalletsData } = useQuery({
    queryKey: ['custom-wallets', currentWorkspaceId],
    queryFn: () => customWalletApi.getAll(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const customWallets = useMemo(() => customWalletsData?.data || [], [customWalletsData?.data])

  // Profile queries
  const { data: profilesData, isLoading: isLoadingProfiles, isFetching, error: profilesError } = useQuery({
    queryKey: ['radius-profiles', currentWorkspaceId, currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash
      ? radiusProfileApi.getTrash(currentPage, pageSize)
      : radiusProfileApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
    enabled: !!currentWorkspaceId,
  })

  const profiles = useMemo(() => profilesData?.data || [], [profilesData?.data])
  const pagination = profilesData?.pagination

  // Calculate max users count for mini chart scaling
  const maxUsersCount = useMemo(() => {
    if (!profiles.length) return 1
    return Math.max(...profiles.map(p => p.usersCount || 0), 1)
  }, [profiles])

  // Track if preferences have been loaded
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  // Load table preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const preferences = await tablePreferenceApi.getPreference('radius-profiles')
        if (preferences) {
          if (preferences.columnWidths) {
            setColumnWidths(JSON.parse(preferences.columnWidths))
          }
          if (preferences.columnOrder) {
            setColumnOrder(JSON.parse(preferences.columnOrder))
          }
          if (preferences.columnVisibility) {
            setColumnVisibility(JSON.parse(preferences.columnVisibility))
          }
          if (preferences.sortField) {
            setSortField(preferences.sortField)
          }
          if (preferences.sortDirection) {
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
          tableName: 'radius-profiles',
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

  // Virtual scrolling - optimized for large datasets
  const rowVirtualizer = useVirtualizer({
    count: profiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Sorting handlers
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

  // Column resize handler
  const handleResize = useCallback((column: string, startX: number, startWidth: number) => {
    setResizing(column)
    let hasMoved = false
    
    const handleMouseMove = (e: MouseEvent) => {
      hasMoved = true
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
    if (column === 'checkbox' || column === 'actions') return
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

  // Bulk selection handlers
  const handleSelectProfile = (profileId: number, checked: boolean) => {
    if (checked) {
      setSelectedProfileIds([...selectedProfileIds, profileId])
    } else {
      setSelectedProfileIds(selectedProfileIds.filter(id => id !== profileId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProfileIds(profiles.map(p => p.id!))
    } else {
      setSelectedProfileIds([])
    }
  }

  // Export functionality
  const handleExport = useCallback(async (format: 'csv' | 'excel') => {
    setIsExporting(true)
    try {
      const blob = format === 'csv' 
        ? await radiusProfileApi.exportCsv()
        : await radiusProfileApi.exportExcel()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `radius-profiles-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success(`Profiles exported as ${format.toUpperCase()}`)
    } catch (error) {
      toast.error(`Failed to export profiles: ${formatApiError(error)}`)
    } finally {
      setIsExporting(false)
    }
  }, [])

  // Reset columns
  const handleResetColumns = () => {
    setResetColumnsDialogOpen(true)
  }

  const confirmResetColumns = async () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
    setColumnWidths(DEFAULT_COLUMN_WIDTHS)
    setColumnOrder(DEFAULT_COLUMN_ORDER)
    
    try {
      await tablePreferenceApi.deletePreference('radius-profiles')
      toast.success('Table columns reset to defaults')
    } catch (error) {
      console.error('Failed to delete preferences:', error)
      toast.error('Columns reset but failed to clear saved preferences')
    }
    
    setResetColumnsDialogOpen(false)
  }

  // Pagination pages generator
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      if (current < total - 2) pages.push('...')
      pages.push(total)
    }
    return pages
  }, [])

  // Profile mutations
  const createProfileMutation = useMutation({
    mutationFn: (data: any) => radiusProfileApi.create(data),
    onSuccess: async (response) => {
      // Save custom attributes for new profile
      const profileId = response?.id || response?.data?.id
      if (profileId && customAttributes.length > 0) {
        try {
          await Promise.all(
            customAttributes.map(attr =>
              radiusCustomAttributeApi.create({
                attributeName: attr.attributeName,
                attributeValue: attr.attributeValue,
                linkType: 'profile',
                radiusProfileId: profileId,
                enabled: attr.enabled
              })
            )
          )
        } catch (error) {
          console.error('Failed to create custom attributes:', error)
          toast.error('Profile created but some custom attributes failed')
        }
      }
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Profile created successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create profile')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusProfileApi.update(id, data),
    onSuccess: async (_, variables) => {
      const profileId = variables.id
      // Update custom attributes
      if (customAttributes.length > 0) {
        try {
          // Delete existing attributes that are not in the current list
          const existingAttrsResponse = await radiusCustomAttributeApi.getAll({
            page: 1,
            pageSize: 1000,
            linkType: 'profile',
            radiusProfileId: profileId,
            includeDeleted: false
          })
          const existingAttrIds = existingAttrsResponse.data.map(a => a.id)
          const currentAttrIds = customAttributes.filter(a => a.id).map(a => a.id!)
          const toDelete = existingAttrIds.filter(id => !currentAttrIds.includes(id))
          
          // Delete removed attributes
          await Promise.all(toDelete.map(id => radiusCustomAttributeApi.delete(id)))
          
          // Create or update attributes
          await Promise.all(
            customAttributes.map(attr => {
              if (attr.id) {
                // Update existing
                return radiusCustomAttributeApi.update(attr.id, {
                  attributeName: attr.attributeName,
                  attributeValue: attr.attributeValue,
                  enabled: attr.enabled
                })
              } else {
                // Create new
                return radiusCustomAttributeApi.create({
                  attributeName: attr.attributeName,
                  attributeValue: attr.attributeValue,
                  linkType: 'profile',
                  radiusProfileId: profileId,
                  enabled: attr.enabled
                })
              }
            })
          )
        } catch (error) {
          console.error('Failed to update custom attributes:', error)
          toast.error('Profile updated but some custom attributes failed')
        }
      } else {
        // Delete all attributes if none are configured
        try {
          const existingAttrsResponse = await radiusCustomAttributeApi.getAll({
            page: 1,
            pageSize: 1000,
            linkType: 'profile',
            radiusProfileId: profileId,
            includeDeleted: false
          })
          await Promise.all(existingAttrsResponse.data.map(a => radiusCustomAttributeApi.delete(a.id)))
        } catch (error) {
          console.error('Failed to delete custom attributes:', error)
        }
      }
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Profile updated successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update profile')
    },
  })

  const deleteProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      toast.success('Profile deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete profile')
    },
  })

  const restoreProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      toast.success('Profile restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore profile')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => radiusProfileApi.delete(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      setSelectedProfileIds([])
      setBulkActionLoading(false)
      toast.success('Profiles deleted successfully')
    },
    onError: (error: any) => {
      setBulkActionLoading(false)
      toast.error(formatApiError(error) || 'Failed to delete profiles')
    },
  })

  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => radiusProfileApi.restore(id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })
      setSelectedProfileIds([])
      setBulkActionLoading(false)
      toast.success('Profiles restored successfully')
    },
    onError: (error: any) => {
      setBulkActionLoading(false)
      toast.error(formatApiError(error) || 'Failed to restore profiles')
    },
  })

  const confirmBulkDelete = () => {
    setBulkActionLoading(true)
    bulkDeleteMutation.mutate(selectedProfileIds)
    setBulkDeleteDialogOpen(false)
  }

  const confirmBulkRestore = () => {
    setBulkActionLoading(true)
    bulkRestoreMutation.mutate(selectedProfileIds)
    setBulkRestoreDialogOpen(false)
  }

  // Handlers
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const handleOpenProfileDialog = async (profile?: RadiusProfile) => {
    if (profile) {
      setEditingProfile(profile)
      setProfileFormData({
        name: profile.name || '',
        downrate: profile.downrate?.toString() || '',
        uprate: profile.uprate?.toString() || '',
        price: profile.price?.toString() || '',
        monthly: profile.monthly?.toString() || '',
        pool: profile.pool || '',
        type: profile.type?.toString() || '',
        expirationAmount: profile.expirationAmount?.toString() || '',
        expirationUnit: profile.expirationUnit?.toString() || '0',
        enabled: profile.enabled ?? true,
        burstEnabled: profile.burstEnabled ?? false,
        limitExpiration: profile.limitExpiration ?? false,
        color: profile.color || '#3b82f6',
        icon: profile.icon || 'Package',
      })
      // Set custom wallets if editing
      if (profile.customWallets && profile.customWallets.length > 0) {
        setEnableCustomWallets(true)
        setSelectedWallets(profile.customWallets.map(w => ({
          customWalletId: w.customWalletId,
          amount: w.amount.toString()
        })))
      } else {
        setEnableCustomWallets(false)
        setSelectedWallets([])
      }
      // Load custom attributes for this profile
      try {
        const attrs = await radiusCustomAttributeApi.getAll({
          page: 1,
          pageSize: 1000,
          linkType: 'profile',
          radiusProfileId: profile.id,
          includeDeleted: false
        })
        setCustomAttributes(attrs.data.map(a => ({
          id: a.id,
          attributeName: a.attributeName,
          attributeValue: a.attributeValue,
          enabled: a.enabled
        })))
      } catch (error) {
        console.error('Failed to load custom attributes:', error)
        setCustomAttributes([])
      }
    } else {
      setEditingProfile(null)
      setProfileFormData({
        name: '',
        downrate: '',
        uprate: '',
        price: '',
        monthly: '',
        pool: '',
        type: '',
        expirationAmount: '',
        expirationUnit: '0',
        enabled: true,
        burstEnabled: false,
        limitExpiration: false,
        color: '#3b82f6',
        icon: 'Package',
      })
      setEnableCustomWallets(false)
      setSelectedWallets([])
      setCustomAttributes([])
    }
    setIsProfileDialogOpen(true)
  }

  const handleCloseProfileDialog = () => {
    setIsProfileDialogOpen(false)
    setEditingProfile(null)
  }

  const handleSaveProfile = async () => {
    if (!profileFormData.name) {
      toast.error('Profile name is required')
      return
    }

    const data = {
      name: profileFormData.name,
      downrate: profileFormData.downrate ? parseInt(profileFormData.downrate) : 0,
      uprate: profileFormData.uprate ? parseInt(profileFormData.uprate) : 0,
      price: profileFormData.price ? parseFloat(profileFormData.price) : 0,
      monthly: profileFormData.monthly ? parseInt(profileFormData.monthly) : 0,
      pool: profileFormData.pool || undefined,
      type: profileFormData.type ? parseInt(profileFormData.type) : 0,
      expirationAmount: profileFormData.expirationAmount ? parseInt(profileFormData.expirationAmount) : 0,
      expirationUnit: profileFormData.expirationUnit ? parseInt(profileFormData.expirationUnit) : 0,
      enabled: profileFormData.enabled,
      burstEnabled: profileFormData.burstEnabled,
      limitExpiration: profileFormData.limitExpiration,
      color: profileFormData.color,
      icon: profileFormData.icon,
      customWallets: enableCustomWallets
        ? selectedWallets.map(w => ({
            customWalletId: w.customWalletId,
            amount: parseFloat(w.amount) || 0
          }))
        : []
    }

    if (editingProfile && editingProfile.id) {
      updateProfileMutation.mutate({ id: editingProfile.id, data })
    } else {
      createProfileMutation.mutate(data)
    }
  }

  const handleDeleteProfile = (id?: number) => {
    if (id) {
      setProfileToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDeleteProfile = () => {
    if (profileToDelete) {
      deleteProfileMutation.mutate(profileToDelete)
      setDeleteDialogOpen(false)
      setProfileToDelete(null)
    }
  }

  const handleRestoreProfile = (profileId: number) => {
    setProfileToRestore(profileId)
    setRestoreDialogOpen(true)
  }

  const confirmRestoreProfile = () => {
    if (profileToRestore) {
      restoreProfileMutation.mutate(profileToRestore)
      setRestoreDialogOpen(false)
      setProfileToRestore(null)
    }
  }

  const formatSpeed = (kbps?: number) => {
    if (!kbps) return 'N/A'
    if (kbps >= 1000000) return `${(kbps / 1000000).toFixed(2)} Gbps`
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`
    return `${kbps} Kbps`
  }

  // Helper function to render column header
  const renderColumnHeader = (columnKey: string) => {
    const columnConfig: Record<string, { label: string | JSX.Element, sortKey?: string, align?: string, draggable?: boolean }> = {
      checkbox: { label: <Checkbox checked={selectedProfileIds.length === profiles.length && profiles.length > 0} onCheckedChange={handleSelectAll} />, draggable: false },
      name: { label: 'Name', sortKey: 'name' },
      status: { label: 'Status', sortKey: 'enabled' },
      download: { label: 'Download', sortKey: 'downrate' },
      upload: { label: 'Upload', sortKey: 'uprate' },
      price: { label: 'Price', sortKey: 'price', align: 'right' },
      pool: { label: 'Pool', sortKey: 'pool' },
      users: { label: 'Users', sortKey: 'usersCount', align: 'right' },
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

  // Helper function to render table cell
  const renderTableCell = (columnKey: string, profile: RadiusProfile) => {
    const visibilityKey = columnKey as keyof typeof columnVisibility
    if (columnKey !== 'checkbox' && columnKey !== 'actions' && columnVisibility[visibilityKey] === false) {
      return null
    }

    const stickyClass = columnKey === 'actions' ? 'sticky right-0 bg-background z-10' : ''
    const baseStyle = { width: `${columnWidths[columnKey as keyof typeof columnWidths]}px` }
    const ProfileIcon = getIconComponent(profile.icon)

    switch (columnKey) {
      case 'checkbox':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Checkbox
              checked={selectedProfileIds.includes(profile.id!)}
              onCheckedChange={(checked) => handleSelectProfile(profile.id!, checked as boolean)}
            />
          </TableCell>
        )
      case 'name':
        return (
          <TableCell key={columnKey} className="h-12 px-4 font-medium" style={baseStyle}>
            <div className="flex items-center gap-2">
              <div 
                className="rounded-lg p-1.5 flex items-center justify-center"
                style={{ backgroundColor: `${profile.color || '#3b82f6'}15`, color: profile.color || '#3b82f6' }}
              >
                <ProfileIcon className="h-4 w-4" />
              </div>
              <span>{profile.name}</span>
            </div>
          </TableCell>
        )
      case 'status':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <Badge variant={profile.enabled ? 'default' : 'secondary'}>
              {profile.enabled ? 'Active' : 'Inactive'}
            </Badge>
          </TableCell>
        )
      case 'download':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {formatSpeed(profile.downrate)}
          </TableCell>
        )
      case 'upload':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {formatSpeed(profile.uprate)}
          </TableCell>
        )
      case 'price':
        return (
          <TableCell key={columnKey} className="h-12 px-4 text-right font-mono" style={baseStyle}>
            {currencySymbol}{(profile.price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </TableCell>
        )
      case 'pool':
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            {profile.pool || '-'}
          </TableCell>
        )
      case 'users':
        const usersCount = profile.usersCount || 0
        const usersPercentage = maxUsersCount > 0 ? (usersCount / maxUsersCount) * 100 : 0
        const barColor = usersCount === 0 ? 'bg-muted' : 
          usersPercentage > 75 ? 'bg-emerald-500' : 
          usersPercentage > 50 ? 'bg-blue-500' : 
          usersPercentage > 25 ? 'bg-amber-500' : 'bg-slate-400'
        return (
          <TableCell key={columnKey} className="h-12 px-4" style={baseStyle}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-end gap-2 min-w-[80px]">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[60px]">
                      <div 
                        className={`h-full ${barColor} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(usersPercentage, usersCount > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium tabular-nums min-w-[40px] text-right">
                      {usersCount.toLocaleString()}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  <p>{usersCount.toLocaleString()} users ({usersPercentage.toFixed(1)}% of max)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TableCell>
        )
      case 'actions':
        return (
          <TableCell key={columnKey} className={`h-12 px-4 text-right ${stickyClass}`} style={baseStyle}>
            <div className="flex justify-end gap-2">
              {!showTrash ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenProfileDialog(profile)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteProfile(profile.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleRestoreProfile(profile.id!)}>
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
          <h1 className="text-2xl font-bold">RADIUS Profiles</h1>
          <p className="text-sm text-muted-foreground">Manage user profiles and bandwidth configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search profiles..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="max-w-sm"
          />
          <Button onClick={handleSearch} variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-profiles'] })} 
            variant="outline" 
            size="icon"
            disabled={isFetching}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Export">
                <Download className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleExport('csv')}
                  disabled={isExporting}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleExport('excel')}
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
                    name: checked,
                    status: checked,
                    download: checked,
                    upload: checked,
                    price: checked,
                    pool: checked,
                    users: checked,
                  })
                }}
                onSelect={(e) => e.preventDefault()}
                className="font-semibold"
              >
                {Object.values(columnVisibility).every(v => v) ? 'Hide All' : 'Show All'}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columnVisibility.name}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.status}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Status
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.download}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, download: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Download Speed
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.upload}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, upload: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Upload Speed
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.price}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, price: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Price
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.pool}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, pool: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Pool
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.users}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, users: checked }))}
                onSelect={(e) => e.preventDefault()}
              >
                Users Count
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Settings">
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
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
            <TabsList>
              <TabsTrigger value="active">
                <Package className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="trash">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => handleOpenProfileDialog()} disabled={showTrash}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>
      </div>

      <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
        <TabsContent value={showTrash ? 'trash' : 'active'} className="mt-0">
          <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoadingProfiles ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 452px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="sticky right-0 bg-muted h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="sticky right-0 bg-card h-12 px-4 w-[120px]">
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
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Package className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Profiles Yet</h3>
              <p className="text-sm text-muted-foreground mb-6">Get started by adding your first profile</p>
              <Button onClick={() => handleOpenProfileDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Profile
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
                    {columnOrder.map(column => renderColumnHeader(column))}
                  </TableRow>
                </TableHeader>
                <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const profile = profiles[virtualRow.index]
                    return (
                      <TableRow
                        key={profile.id}
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
                        {columnOrder.map(column => renderTableCell(column, profile))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
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
                      <SelectItem value="999999">All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground font-medium">
                  Showing {profiles.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + profiles.length} of {pagination.totalRecords} profiles
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

  {/* Bulk Action Bar */}
  {selectedProfileIds.length > 0 && (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
      <span className="font-medium">
        {selectedProfileIds.length} profile(s) selected
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
      )}
      
      <Button
        variant="ghost"
        size="sm"
        className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
        onClick={() => setSelectedProfileIds([])}
        disabled={bulkActionLoading}
      >
        Clear
      </Button>
    </div>
  )}

      {/* Profile Dialog */}
      {isProfileDialogOpen && (
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Update profile details' : 'Fill in the profile details'}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="network">Speed & Network</TabsTrigger>
                <TabsTrigger value="wallets">Custom Wallets</TabsTrigger>
                <TabsTrigger value="attributes">Attributes</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Profile Name *</Label>
                    <Input
                      id="name"
                      value={profileFormData.name}
                      onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                      placeholder="e.g., Basic Plan"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price ({workspace?.currency || 'USD'})</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">{currencySymbol}</span>
                      <Input
                        id="price"
                        type="text"
                        value={workspace?.currency === 'IQD' && profileFormData.price ? formatNumber(profileFormData.price) : profileFormData.price}
                        onChange={(e) => {
                          const value = workspace?.currency === 'IQD' ? parseFormattedNumber(e.target.value) : e.target.value
                          // Only allow numbers and decimal point
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setProfileFormData({ ...profileFormData, price: value })
                          }
                        }}
                        placeholder={workspace?.currency === 'IQD' ? '0' : '0.00'}
                        className={workspace?.currency === 'IQD' ? 'pl-10' : 'pl-7'}
                      />
                    </div>
                  </div>
                </div>

                {/* Color and Icon Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Color</Label>
                    <Select
                      value={profileFormData.color}
                      onValueChange={(value) => setProfileFormData({ ...profileFormData, color: value })}
                    >
                      <SelectTrigger>
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded" style={{ backgroundColor: profileFormData.color }} />
                          <span>{PREDEFINED_COLORS.find(c => c.value === profileFormData.color)?.label || 'Blue'}</span>
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        {PREDEFINED_COLORS.map((color) => (
                          <SelectItem key={color.value} value={color.value}>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded border" style={{ backgroundColor: color.value }} />
                              <span>{color.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Icon</Label>
                    <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start"
                        >
                          {(() => {
                            const IconComponent = getIconComponent(profileFormData.icon)
                            return (
                              <div className="flex items-center gap-2">
                                <div 
                                  className="rounded-lg p-1.5 flex items-center justify-center"
                                  style={{ backgroundColor: `${profileFormData.color}15`, color: profileFormData.color }}
                                >
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <span>{profileFormData.icon}</span>
                              </div>
                            )
                          })()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[320px] p-4" 
                        align="start"
                        style={{ zIndex: 9999 }}
                        sideOffset={5}
                      >
                        <div className="grid grid-cols-6 gap-2 max-h-[240px] overflow-y-auto">
                          {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                            <Button
                              key={name}
                              type="button"
                              variant={profileFormData.icon === name ? "default" : "outline"}
                              size="sm"
                              className="h-10 w-10 p-0"
                              onClick={() => {
                                setProfileFormData({ ...profileFormData, icon: name })
                                setIconPopoverOpen(false)
                              }}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="monthly">Monthly Fee</Label>
                  <Input
                    id="monthly"
                    type="number"
                    value={profileFormData.monthly}
                    onChange={(e) => setProfileFormData({ ...profileFormData, monthly: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enabled"
                      checked={profileFormData.enabled}
                      onCheckedChange={(checked) => setProfileFormData({ ...profileFormData, enabled: checked })}
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="burstEnabled"
                      checked={profileFormData.burstEnabled}
                      onCheckedChange={(checked) => setProfileFormData({ ...profileFormData, burstEnabled: checked })}
                    />
                    <Label htmlFor="burstEnabled">Burst Enabled</Label>
                  </div>
                </div>
              </TabsContent>

              {/* Speed & Network Tab */}
              <TabsContent value="network" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="downrate">Download Speed (Kbps)</Label>
                    <Input
                      id="downrate"
                      type="number"
                      value={profileFormData.downrate}
                      onChange={(e) => setProfileFormData({ ...profileFormData, downrate: e.target.value })}
                      placeholder="e.g., 10240"
                    />
                    <p className="text-xs text-muted-foreground">Enter speed in kilobits per second</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="uprate">Upload Speed (Kbps)</Label>
                    <Input
                      id="uprate"
                      type="number"
                      value={profileFormData.uprate}
                      onChange={(e) => setProfileFormData({ ...profileFormData, uprate: e.target.value })}
                      placeholder="e.g., 2048"
                    />
                    <p className="text-xs text-muted-foreground">Enter speed in kilobits per second</p>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="pool">IP Pool</Label>
                  <Input
                    id="pool"
                    value={profileFormData.pool}
                    onChange={(e) => setProfileFormData({ ...profileFormData, pool: e.target.value })}
                    placeholder="e.g., main-pool"
                  />
                  <p className="text-xs text-muted-foreground">Specify the IP pool name for this profile</p>
                </div>
              </TabsContent>

              {/* Custom Wallets Tab */}
              <TabsContent value="wallets" className="space-y-4 mt-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id="enableCustomWallets"
                    checked={enableCustomWallets}
                    onCheckedChange={(checked) => {
                      setEnableCustomWallets(checked)
                      if (!checked) {
                        setSelectedWallets([])
                      }
                    }}
                  />
                  <Label htmlFor="enableCustomWallets" className="font-semibold">Link to Custom Wallets</Label>
                </div>

                {enableCustomWallets && (
                  <div className="space-y-3">
                    {selectedWallets.map((wallet, index) => (
                      <div key={index} className="grid grid-cols-[2fr_1fr_auto] gap-2 items-end p-3 border rounded-lg">
                        <div className="space-y-2">
                          <Label>Wallet</Label>
                          <Select
                            value={wallet.customWalletId.toString()}
                            onValueChange={(value) => {
                              const updated = [...selectedWallets]
                              updated[index].customWalletId = parseInt(value)
                              setSelectedWallets(updated)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select wallet" />
                            </SelectTrigger>
                            <SelectContent>
                              {customWallets.map((cw) => (
                                <SelectItem key={cw.id} value={cw.id.toString()}>
                                  {cw.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={wallet.amount}
                            onChange={(e) => {
                              const updated = [...selectedWallets]
                              updated[index].amount = e.target.value
                              setSelectedWallets(updated)
                            }}
                            placeholder="0.00"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedWallets(selectedWallets.filter((_, i) => i !== index))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (customWallets.length > 0) {
                          setSelectedWallets([...selectedWallets, { customWalletId: customWallets[0].id, amount: '' }])
                        } else {
                          toast.error('No custom wallets available')
                        }
                      }}
                      disabled={customWallets.length === 0}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Wallet
                    </Button>
                  </div>
                )}

                {!enableCustomWallets && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">Enable custom wallets to link this profile with wallet amounts</p>
                  </div>
                )}
              </TabsContent>

              {/* Custom Attributes Tab */}
              <TabsContent value="attributes" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-semibold">Custom RADIUS Attributes</Label>
                    <p className="text-sm text-muted-foreground mt-1">Add custom RADIUS attributes for this profile</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomAttributes([...customAttributes, { attributeName: '', attributeValue: '', enabled: true }])
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Attribute
                  </Button>
                </div>
                
                {customAttributes.length > 0 ? (
                  <div className="space-y-3">
                    {customAttributes.map((attr, index) => (
                      <div key={index} className="grid grid-cols-[2fr_2fr_auto_auto] gap-3 items-end p-4 border rounded-lg bg-muted/50">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Attribute Name</Label>
                          <Input
                            value={attr.attributeName}
                            onChange={(e) => {
                              const updated = [...customAttributes]
                              updated[index].attributeName = e.target.value
                              setCustomAttributes(updated)
                            }}
                            placeholder="e.g., Alc-SLA-Prof-Str"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Value</Label>
                          <Input
                            value={attr.attributeValue}
                            onChange={(e) => {
                              const updated = [...customAttributes]
                              updated[index].attributeValue = e.target.value
                              setCustomAttributes(updated)
                            }}
                            placeholder="e.g., P1"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <Switch
                            checked={attr.enabled}
                            onCheckedChange={(checked) => {
                              const updated = [...customAttributes]
                              updated[index].enabled = checked
                              setCustomAttributes(updated)
                            }}
                          />
                          <Label className="text-xs font-medium">Enabled</Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCustomAttributes(customAttributes.filter((_, i) => i !== index))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">No custom attributes added</p>
                    <p className="text-xs mt-1">Click "Add Attribute" to create custom RADIUS attributes</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleCloseProfileDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveProfile}
                disabled={!profileFormData.name || createProfileMutation.isPending || updateProfileMutation.isPending}
              >
                {editingProfile ? 'Update' : 'Create'}
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
              This will move the profile to trash. You can restore it later from the trash view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProfile}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the profile and make it active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreProfile}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedProfileIds.length} Profile(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the selected profiles to trash. You can restore them later from the trash view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Restore Confirmation Dialog */}
      <AlertDialog open={bulkRestoreDialogOpen} onOpenChange={setBulkRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {selectedProfileIds.length} Profile(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the selected profiles and make them active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRestore}>Restore</AlertDialogAction>
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
            <AlertDialogAction onClick={confirmResetColumns}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
