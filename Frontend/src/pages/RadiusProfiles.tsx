import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal
} from 'lucide-react'
import { radiusProfileApi, type RadiusProfile } from '@/api/radiusProfileApi'
import { customWalletApi } from '@/api/customWallets'
import { workspaceApi } from '@/lib/api'
import { formatApiError } from '@/utils/errorHandler'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'
  { name: 'Shield', icon: Shield },
  { name: 'Users', icon: Users },
  { name: 'User', icon: User },
  { name: 'Building', icon: Building },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Rocket', icon: Rocket },
  { name: 'Target', icon: Target },
  { name: 'Award', icon: Award },
  { name: 'Medal', icon: Medal },
  { name: 'Flag', icon: Flag },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'AlertCircle', icon: AlertCircle },
export default function RadiusProfiles() {
  const { id } = useParams<{ id: string }>()
  const workspaceId = parseInt(id || '0')
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

  //Profile state
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<RadiusProfile | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [profileToRestore, setProfileToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  // Color and Icon picker state
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    status: true,
    download: true,
    upload: true,
    price: true,
    pool: true,
    users: true,
  })

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

  // Fetch workspace currency
  const { data: workspace } = useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: () => workspaceApi.getById(workspaceId),
    enabled: workspaceId > 0,
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

  // Fetch custom wallets
  const { data: customWalletsData } = useQuery({
    queryKey: ['custom-wallets', workspaceId],
    queryFn: () => customWalletApi.getAll(workspaceId),
    enabled: workspaceId > 0,
  })

  const customWallets = useMemo(() => customWalletsData?.data || [], [customWalletsData?.data])

  // Profile queries
  const { data: profilesData, isLoading: isLoadingProfiles, isFetching, error: profilesError } = useQuery({
    queryKey: ['radius-profiles', workspaceId, currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash
      ? radiusProfileApi.getTrash(workspaceId, currentPage, pageSize)
      : radiusProfileApi.getAll(workspaceId, currentPage, pageSize, searchQuery, sortField, sortDirection),
    enabled: workspaceId > 0,
  })

  const profiles = useMemo(() => profilesData?.data || [], [profilesData?.data])
  const pagination = profilesData?.pagination

  // Virtual scrolling - optimized for large datasets
  const rowVirtualizer = useVirtualizer({
    count: profiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Sorting handlers
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }, [sortField, sortDirection])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

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
    mutationFn: (data: any) => radiusProfileApi.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile created successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create profile')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusProfileApi.update(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile updated successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update profile')
    },
  })

  const deleteProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.delete(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete profile')
    },
  })

  const restoreProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.restore(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore profile')
    },
  })

  // Handlers
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const handleOpenProfileDialog = (profile?: RadiusProfile) => {
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
    }
    setIsProfileDialogOpen(true)
  }

  const handleCloseProfileDialog = () => {
    setIsProfileDialogOpen(false)
    setEditingProfile(null)
  }

  const handleSaveProfile = () => {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RADIUS Profiles</h1>
          <p className="text-muted-foreground">Manage user profiles and bandwidth configurations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowTrash(!showTrash)}
            variant={showTrash ? 'default' : 'outline'}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showTrash ? 'Show Active' : 'Show Trash'}
          </Button>
          {!showTrash && (
            <Button onClick={() => handleOpenProfileDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
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
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })} 
                  variant="outline" 
                  size="icon"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
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
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
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
            </div>
          </div>
        </CardHeader>
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
            <div className="text-center py-8 text-muted-foreground">
              No profiles found.
            </div>
          ) : (
            <div ref={parentRef} className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
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
                    {columnVisibility.name && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[180px] cursor-pointer select-none" onClick={() => handleSort('name')}>Name{getSortIcon('name')}</TableHead>}
                    {columnVisibility.status && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('enabled')}>Status{getSortIcon('enabled')}</TableHead>}
                    {columnVisibility.download && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('downrate')}>Download{getSortIcon('downrate')}</TableHead>}
                    {columnVisibility.upload && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('uprate')}>Upload{getSortIcon('uprate')}</TableHead>}
                    {columnVisibility.price && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('price')}>Price{getSortIcon('price')}</TableHead>}
                    {columnVisibility.pool && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('pool')}>Pool{getSortIcon('pool')}</TableHead>}
                    {columnVisibility.users && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('userCount')}>Users{getSortIcon('userCount')}</TableHead>}
                    <TableHead className="sticky right-0 bg-muted shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const profile = profiles[virtualRow.index]
                    const ProfileIcon = getIconComponent(profile.icon)
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
                        {columnVisibility.name && (
                          <TableCell className="h-12 px-4 font-medium w-[180px]">
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
                        )}
                        {columnVisibility.status && <TableCell className="h-12 px-4 w-[100px]">
                          <Badge variant={profile.enabled ? 'default' : 'secondary'}>
                            {profile.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>}
                        {columnVisibility.download && <TableCell className="h-12 px-4 w-[140px]">{formatSpeed(profile.downrate)}</TableCell>}
                        {columnVisibility.upload && <TableCell className="h-12 px-4 w-[140px]">{formatSpeed(profile.uprate)}</TableCell>}
                        {columnVisibility.price && <TableCell className="h-12 px-4 text-right font-mono w-[120px]">{currencySymbol}{(profile.price || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TableCell>}
                        {columnVisibility.pool && <TableCell className="h-12 px-4 w-[140px]">{profile.pool || '-'}</TableCell>}
                        {columnVisibility.users && <TableCell className="h-12 px-4 text-right w-[100px]">{profile.usersCount || 0}</TableCell>}
                        <TableCell className="sticky right-0 bg-card shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 text-right w-[120px]">
                          <div className="flex justify-end gap-2">
                            {showTrash ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRestoreProfile(profile.id!)}
                                disabled={restoreProfileMutation.isPending}
                                title="Restore profile"
                              >
                                <RotateCcw className="h-4 w-4 text-green-600" />
                              </Button>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenProfileDialog(profile)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteProfile(profile.id)}
                                  disabled={deleteProfileMutation.isPending}
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

          {/* Pagination Controls */}
          {pagination && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <div className="text-sm text-muted-foreground">
                Showing {profiles.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + profiles.length} of {pagination.totalRecords} profiles
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
                      size="sm"
                      disabled
                      className="w-9 p-0"
                    >
                      ...
                    </Button>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page as number)}
                      className="w-9 p-0"
                    >
                      {page}
                    </Button>
                  )
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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

      {/* Profile Dialog */}
      {isProfileDialogOpen && (
        <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</DialogTitle>
              <DialogDescription>
                {editingProfile ? 'Update profile details' : 'Fill in the profile details'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
                      type="number"
                      step="0.01"
                      min="0"
                      value={profileFormData.price}
                      onChange={(e) => setProfileFormData({ ...profileFormData, price: e.target.value })}
                      placeholder="0.00"
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
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
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
                    {iconPopoverOpen && (
                      <div className="absolute z-50 mt-1 w-[320px] rounded-md border bg-popover p-4 text-popover-foreground shadow-md">
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
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="pool">IP Pool</Label>
                  <Input
                    id="pool"
                    value={profileFormData.pool}
                    onChange={(e) => setProfileFormData({ ...profileFormData, pool: e.target.value })}
                    placeholder="e.g., main-pool"
                  />
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
              </div>
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

              {/* Custom Wallets Configuration */}
              <div className="border-t pt-4 mt-4">
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
                  <div className="space-y-3 pl-6">
                    {selectedWallets.map((wallet, index) => (
                      <div key={index} className="grid grid-cols-[2fr_1fr_auto] gap-2 items-end">
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
              </div>
            </div>
            <DialogFooter>
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
    </div>
  )
}
