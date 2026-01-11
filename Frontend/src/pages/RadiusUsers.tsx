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
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText, List, Users } from 'lucide-react'
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
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
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
    simultaneousSessions: false,
    tags: true,
  })

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
    balance: '',
    expiration: '',
    enabled: true,
    staticIp: '',
    company: '',
    address: '',
    contractId: '',
    simultaneousSessions: '1',
    zoneId: '',
  })

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

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
        balance: user.balance?.toString() || '0',
        expiration: user.expiration ? user.expiration.substring(0, 10) : '',
        enabled: user.enabled,
        staticIp: user.staticIp || '',
        company: user.company || '',
        address: user.address || '',
        contractId: user.contractId || '',
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
        balance: '0',
        expiration: '',
        enabled: true,
        staticIp: '',
        company: '',
        address: '',
        contractId: '',
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
      balance: parseFloat(formData.balance) || 0,
      expiration: formData.expiration ? new Date(formData.expiration).toISOString() : undefined,
      enabled: formData.enabled,
      staticIp: formData.staticIp || undefined,
      company: formData.company || undefined,
      address: formData.address || undefined,
      contractId: formData.contractId || undefined,
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

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }, [sortField, sortDirection])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

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

  return (
    <div className="space-y-6 overflow-x-hidden">
      {isExporting && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Exporting data...</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('radiusUsers.title')}</h1>
          <p className="text-muted-foreground">{t('radiusUsers.subtitle')}</p>
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
          <div className="flex items-center gap-2">
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
                          simultaneousSessions: checked,
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
                      checked={columnVisibility.simultaneousSessions}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, simultaneousSessions: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Simultaneous Sessions
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
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('radiusUsers.noUsersFound')}
            </div>
          ) : (
            <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 340px)' }}>
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
                      {columnVisibility.username && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[150px] cursor-pointer select-none" onClick={() => handleSort('username')}>{t('radiusUsers.username')}{getSortIcon('username')}</TableHead>}
                      {columnVisibility.name && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[180px] cursor-pointer select-none" onClick={() => handleSort('name')}>{t('radiusUsers.name')}{getSortIcon('name')}</TableHead>}
                      {columnVisibility.email && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[200px] cursor-pointer select-none" onClick={() => handleSort('email')}>{t('radiusUsers.email')}{getSortIcon('email')}</TableHead>}
                      {columnVisibility.phone && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('phone')}>{t('radiusUsers.phone')}{getSortIcon('phone')}</TableHead>}
                      {columnVisibility.city && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('city')}>City{getSortIcon('city')}</TableHead>}
                      {columnVisibility.profile && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('profile')}>{t('radiusUsers.profile')}{getSortIcon('profile')}</TableHead>}
                      {columnVisibility.status && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('enabled')}>{t('radiusUsers.status')}{getSortIcon('enabled')}</TableHead>}
                      {columnVisibility.balance && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('balance')}>{t('radiusUsers.balance')}{getSortIcon('balance')}</TableHead>}
                      {columnVisibility.loanBalance && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('loanBalance')}>Loan Balance{getSortIcon('loanBalance')}</TableHead>}
                      {columnVisibility.expiration && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('expiration')}>{t('radiusUsers.expiration')}{getSortIcon('expiration')}</TableHead>}
                      {columnVisibility.lastOnline && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('lastOnline')}>Last Online{getSortIcon('lastOnline')}</TableHead>}
                      {columnVisibility.onlineStatus && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('onlineStatus')}>Online{getSortIcon('onlineStatus')}</TableHead>}
                      {columnVisibility.remainingDays && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('remainingDays')}>Remaining Days{getSortIcon('remainingDays')}</TableHead>}
                      {columnVisibility.debtDays && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('debtDays')}>Debt Days{getSortIcon('debtDays')}</TableHead>}
                      {columnVisibility.staticIp && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('staticIp')}>Static IP{getSortIcon('staticIp')}</TableHead>}
                      {columnVisibility.company && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('company')}>Company{getSortIcon('company')}</TableHead>}
                      {columnVisibility.address && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[160px] cursor-pointer select-none" onClick={() => handleSort('address')}>Address{getSortIcon('address')}</TableHead>}
                      {columnVisibility.contractId && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('contractId')}>Contract ID{getSortIcon('contractId')}</TableHead>}
                      {columnVisibility.simultaneousSessions && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('simultaneousSessions')}>Sessions{getSortIcon('simultaneousSessions')}</TableHead>}
                      {columnVisibility.tags && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[200px]">Tags</TableHead>}
                      <TableHead className="sticky right-0 bg-muted shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px]">{t('radiusUsers.actions')}</TableHead>
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
                          {columnVisibility.username && <TableCell className="h-12 px-4 font-medium whitespace-nowrap w-[150px]">{user.username}</TableCell>}
                          {columnVisibility.name && <TableCell className="h-12 px-4 w-[180px]">
                            {user.firstname || user.lastname
                              ? `${user.firstname || ''} ${user.lastname || ''}`.trim()
                              : '-'}
                          </TableCell>}
                          {columnVisibility.email && <TableCell className="h-12 px-4 w-[200px] truncate" title={user.email || '-'}>
                            {user.email || '-'}
                          </TableCell>}
                          {columnVisibility.phone && <TableCell className="h-12 px-4 w-[140px]">{user.phone || '-'}</TableCell>}
                          {columnVisibility.city && <TableCell className="h-12 px-4 w-[140px]">{user.city || '-'}</TableCell>}
                          {columnVisibility.profile && <TableCell className="h-12 px-4 w-[140px]">{user.profileName || '-'}</TableCell>}
                          {columnVisibility.status && <TableCell className="h-12 px-4 w-[100px]">
                            <Badge variant={user.enabled ? 'default' : 'secondary'}>
                              {user.enabled ? t('radiusUsers.enabled') : t('radiusUsers.disabled')}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.balance && <TableCell className="h-12 px-4 text-right font-mono w-[120px]">{currencySymbol} {formatCurrency(user.balance || 0)}</TableCell>}
                          {columnVisibility.loanBalance && <TableCell className="h-12 px-4 text-right font-mono w-[120px]">{currencySymbol} {formatCurrency(user.loanBalance || 0)}</TableCell>}
                          {columnVisibility.expiration && <TableCell className="h-12 px-4 w-[120px]">{formatDate(user.expiration)}</TableCell>}
                          {columnVisibility.lastOnline && <TableCell className="h-12 px-4 w-[120px]">{formatDate(user.lastOnline)}</TableCell>}
                          {columnVisibility.onlineStatus && <TableCell className="h-12 px-4 w-[100px]">
                            <Badge variant={user.onlineStatus ? 'default' : 'secondary'}>
                              {user.onlineStatus ? 'Online' : 'Offline'}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.remainingDays && <TableCell className="h-12 px-4 text-right w-[120px]">{user.remainingDays || '0'}</TableCell>}
                          {columnVisibility.debtDays && <TableCell className="h-12 px-4 text-right w-[100px]">{user.debtDays || '0'}</TableCell>}
                          {columnVisibility.staticIp && <TableCell className="h-12 px-4 w-[140px]">{user.staticIp || '-'}</TableCell>}
                          {columnVisibility.company && <TableCell className="h-12 px-4 w-[140px]">{user.company || '-'}</TableCell>}
                          {columnVisibility.address && <TableCell className="h-12 px-4 w-[160px]">{user.address || '-'}</TableCell>}
                          {columnVisibility.contractId && <TableCell className="h-12 px-4 w-[120px]">{user.contractId || '-'}</TableCell>}
                          {columnVisibility.simultaneousSessions && <TableCell className="h-12 px-4 text-right w-[100px]">{user.simultaneousSessions || '1'}</TableCell>}
                          {columnVisibility.tags && <TableCell className="h-12 px-4 w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {user.tags && user.tags.length > 0 ? (
                                user.tags.map((tag) => (
                                  <Badge 
                                    key={tag.id} 
                                    variant="outline"
                                    className="text-xs"
                                    style={{ 
                                      borderColor: tag.color,
                                      color: tag.color
                                    }}
                                  >
                                    {tag.title}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </div>
                          </TableCell>}
                          <TableCell className="sticky right-0 bg-card shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 text-right w-[120px]">
                            <div className="flex justify-end gap-2">
                              {showTrash ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(user.id!)}
                                  disabled={restoreMutation.isPending}
                                  title="Restore user"
                                >
                                  <RotateCcw className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(user.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
              </Table>
            </div>
          )}
          
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
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2" />
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
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

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
                <Label htmlFor="balance">{t('radiusUsers.balance')}</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="e.g., 100.00"
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
    </div>
  )
}

