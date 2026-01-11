import { useState, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Textarea } from '@/components/ui/textarea'
import { 
  Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, 
  ArrowUpDown, ArrowUp, ArrowDown, Eye, EyeOff, Circle
} from 'lucide-react'
import { radiusNasApi, type RadiusNas } from '@/api/radiusNasApi'
import { radiusIpPoolApi, type RadiusIpPool } from '@/api/radiusIpPoolApi'
import { formatApiError } from '@/utils/errorHandler'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// NAS Type mapping
const NAS_TYPES: Record<number, string> = {
  1: 'Cisco',
  2: 'Mikrotik',
  3: 'Nokia',
  4: 'Huawei',
  5: 'Juniper',
  6: 'ZTE',
  7: 'Ericsson',
  8: 'Alcatel',
  9: 'HP',
  10: 'Dell',
  11: 'Other',
}

const getNasTypeName = (type: number): string => {
  return NAS_TYPES[type] || 'Unknown'
}

export default function RadiusNasPage() {
  const { id } = useParams<{ id: string }>()
  const workspaceId = parseInt(id || '0')
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

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
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  // NAS state
  const [isNasDialogOpen, setIsNasDialogOpen] = useState(false)
  const [editingNas, setEditingNas] = useState<RadiusNas | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [nasToDelete, setNasToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [nasToRestore, setNasToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [currentTab, setCurrentTab] = useState('basic')

  const [nasFormData, setNasFormData] = useState({
    nasname: '',
    shortname: '',
    type: '2',
    secret: '',
    apiUsername: '',
    apiPassword: '',
    coaPort: '1700',
    version: '',
    description: '',
    server: '',
    enabled: true,
    siteId: '',
    httpPort: '80',
    monitor: true,
    ipAccountingEnabled: true,
    poolName: '',
    apiPort: '',
    snmpCommunity: '',
    sshUsername: '',
    sshPassword: '',
    sshPort: '22',
  })

  // NAS queries
  const { data: nasData, isLoading, isFetching, error } = useQuery({
    queryKey: ['radius-nas', currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash
      ? radiusNasApi.getTrash(currentPage, pageSize)
      : radiusNasApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
    enabled: workspaceId > 0,
  })

  const nasDevices = nasData?.data || []
  const pagination = nasData?.pagination

  // IP Pools query for dropdown
  const { data: ipPoolsData } = useQuery({
    queryKey: ['radius-ip-pools-all'],
    queryFn: () => radiusIpPoolApi.getAll(1, 200, '', '', 'asc', false),
    enabled: workspaceId > 0,
  })

  const ipPools = ipPoolsData?.data || []

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

  // Pagination
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

  // NAS mutations
  const createNasMutation = useMutation({
    mutationFn: (data: any) => radiusNasApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] })
      toast.success('NAS device created successfully')
      handleCloseNasDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create NAS device')
    },
  })

  const updateNasMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusNasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] })
      toast.success('NAS device updated successfully')
      handleCloseNasDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update NAS device')
    },
  })

  const deleteNasMutation = useMutation({
    mutationFn: (id: number) => radiusNasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] })
      toast.success('NAS device deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete NAS device')
    },
  })

  const restoreNasMutation = useMutation({
    mutationFn: (id: number) => radiusNasApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-nas'] })
      toast.success('NAS device restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore NAS device')
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

  const handleOpenNasDialog = (nas?: RadiusNas) => {
    if (nas) {
      setEditingNas(nas)
      setNasFormData({
        nasname: nas.nasname || '',
        shortname: nas.shortname || '',
        type: nas.type?.toString() || '2',
        secret: nas.secret || '',
        apiUsername: nas.apiUsername || '',
        apiPassword: nas.apiPassword || '',
        coaPort: nas.coaPort?.toString() || '1700',
        version: nas.version || '',
        description: nas.description || '',
        server: nas.server || '',
        enabled: nas.enabled === 1,
        siteId: nas.siteId?.toString() || '',
        httpPort: nas.httpPort?.toString() || '80',
        monitor: nas.monitor === 1,
        ipAccountingEnabled: nas.ipAccountingEnabled === 1,
        poolName: nas.poolName || '',
        apiPort: nas.apiPort?.toString() || '',
        snmpCommunity: nas.snmpCommunity || '',
        sshUsername: nas.sshUsername || '',
        sshPassword: nas.sshPassword || '',
        sshPort: nas.sshPort?.toString() || '22',
      })
    } else {
      setEditingNas(null)
      setNasFormData({
        nasname: '',
        shortname: '',
        type: '2',
        secret: '',
        apiUsername: '',
        apiPassword: '',
        coaPort: '1700',
        version: '',
        description: '',
        server: '',
        enabled: true,
        siteId: '',
        httpPort: '80',
        monitor: true,
        ipAccountingEnabled: true,
        poolName: '',
        apiPort: '',
        snmpCommunity: '',
        sshUsername: '',
        sshPassword: '',
        sshPort: '22',
      })
    }
    setCurrentTab('basic')
    setIsNasDialogOpen(true)
  }

  const handleCloseNasDialog = () => {
    setIsNasDialogOpen(false)
    setEditingNas(null)
    setShowPassword(false)
  }

  const handleSaveNas = () => {
    if (!nasFormData.nasname) {
      toast.error('NAS name is required')
      return
    }
    if (!nasFormData.shortname) {
      toast.error('Short name is required')
      return
    }
    if (!nasFormData.secret) {
      toast.error('Secret is required')
      return
    }

    const data = {
      nasname: nasFormData.nasname,
      shortname: nasFormData.shortname,
      type: parseInt(nasFormData.type),
      secret: nasFormData.secret,
      apiUsername: nasFormData.apiUsername || undefined,
      apiPassword: nasFormData.apiPassword || undefined,
      coaPort: parseInt(nasFormData.coaPort),
      version: nasFormData.version || undefined,
      description: nasFormData.description || undefined,
      server: nasFormData.server || undefined,
      enabled: nasFormData.enabled ? 1 : 0,
      siteId: nasFormData.siteId ? parseInt(nasFormData.siteId) : undefined,
      httpPort: parseInt(nasFormData.httpPort),
      monitor: nasFormData.monitor ? 1 : 0,
      ipAccountingEnabled: nasFormData.ipAccountingEnabled ? 1 : 0,
      poolName: nasFormData.poolName || undefined,
      apiPort: nasFormData.apiPort ? parseInt(nasFormData.apiPort) : undefined,
      snmpCommunity: nasFormData.snmpCommunity || undefined,
      sshUsername: nasFormData.sshUsername || undefined,
      sshPassword: nasFormData.sshPassword || undefined,
      sshPort: parseInt(nasFormData.sshPort),
    }

    if (editingNas && editingNas.id) {
      updateNasMutation.mutate({ id: editingNas.id, data })
    } else {
      createNasMutation.mutate(data)
    }
  }

  const handleDeleteNas = (id?: number) => {
    if (id) {
      setNasToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (nasToDelete) {
      deleteNasMutation.mutate(nasToDelete)
      setDeleteDialogOpen(false)
      setNasToDelete(null)
    }
  }

  const handleRestoreNas = (id?: number) => {
    if (id) {
      setNasToRestore(id)
      setRestoreDialogOpen(true)
    }
  }

  const confirmRestore = () => {
    if (nasToRestore) {
      restoreNasMutation.mutate(nasToRestore)
      setRestoreDialogOpen(false)
      setNasToRestore(null)
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading NAS Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{formatApiError(error)}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Network Access Servers</h1>
          <p className="text-muted-foreground">
            Manage RADIUS NAS devices for network authentication
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showTrash ? 'default' : 'outline'}
            onClick={() => {
              setShowTrash(!showTrash)
              setCurrentPage(1)
            }}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showTrash ? 'Show Active' : 'Show Trash'}
          </Button>
          {!showTrash && (
            <Button onClick={() => handleOpenNasDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add NAS Device
            </Button>
          )}
        </div>
      </div>

      {/* Main Card */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          {/* Search and Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search NAS devices..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / page</SelectItem>
                <SelectItem value="50">50 / page</SelectItem>
                <SelectItem value="100">100 / page</SelectItem>
                <SelectItem value="200">200 / page</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('nasname')}>
                    NAS Name {getSortIcon('nasname')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('shortname')}>
                    Short Name {getSortIcon('shortname')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('type')}>
                    Type {getSortIcon('type')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('version')}>
                    Version {getSortIcon('version')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('enabled')}>
                    Status {getSortIcon('enabled')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('monitor')}>
                    Monitor {getSortIcon('monitor')}
                  </TableHead>
                  <TableHead>Ping</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isFetching ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : nasDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {showTrash ? 'No deleted NAS devices found' : 'No NAS devices found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  nasDevices.map((nas) => (
                    <TableRow key={nas.id}>
                      <TableCell className="font-medium">{nas.nasname}</TableCell>
                      <TableCell>{nas.shortname}</TableCell>
                      <TableCell>{getNasTypeName(nas.type)}</TableCell>
                      <TableCell>{nas.version || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={nas.enabled === 1 ? 'default' : 'secondary'}>
                          {nas.enabled === 1 ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={nas.monitor === 1 ? 'default' : 'outline'}>
                          {nas.monitor === 1 ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Circle 
                            className={`h-3 w-3 ${
                              nas.pingLoss === 0 ? 'fill-green-500 text-green-500' : 
                              nas.pingLoss < 50 ? 'fill-yellow-500 text-yellow-500' : 
                              'fill-red-500 text-red-500'
                            }`}
                          />
                          <span className="text-sm text-muted-foreground">
                            {nas.pingTime >= 0 ? `${nas.pingTime}ms` : 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {showTrash ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreNas(nas.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenNasDialog(nas)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteNas(nas.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalRecords)} of {pagination.totalRecords} results
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPaginationPages(currentPage, pagination.totalPages).map((page, index) =>
                  typeof page === 'number' ? (
                    <Button
                      key={index}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ) : (
                    <span key={index} className="px-2">
                      {page}
                    </span>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isNasDialogOpen} onOpenChange={setIsNasDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNas ? 'Edit NAS Device' : 'Add NAS Device'}</DialogTitle>
            <DialogDescription>
              {editingNas ? 'Update NAS device details' : 'Add a new network access server to your RADIUS setup'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nasname">NAS Name / IP *</Label>
                  <Input
                    id="nasname"
                    value={nasFormData.nasname}
                    onChange={(e) => setNasFormData({ ...nasFormData, nasname: e.target.value })}
                    placeholder="192.168.2.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortname">Short Name *</Label>
                  <Input
                    id="shortname"
                    value={nasFormData.shortname}
                    onChange={(e) => setNasFormData({ ...nasFormData, shortname: e.target.value })}
                    placeholder="PPPoE-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={nasFormData.type}
                    onValueChange={(value) => setNasFormData({ ...nasFormData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select NAS type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Cisco</SelectItem>
                      <SelectItem value="2">Mikrotik</SelectItem>
                      <SelectItem value="3">Nokia</SelectItem>
                      <SelectItem value="4">Huawei</SelectItem>
                      <SelectItem value="5">Juniper</SelectItem>
                      <SelectItem value="6">ZTE</SelectItem>
                      <SelectItem value="7">Ericsson</SelectItem>
                      <SelectItem value="8">Alcatel</SelectItem>
                      <SelectItem value="9">HP</SelectItem>
                      <SelectItem value="10">Dell</SelectItem>
                      <SelectItem value="11">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    value={nasFormData.version}
                    onChange={(e) => setNasFormData({ ...nasFormData, version: e.target.value })}
                    placeholder="cisco_asr_9xxx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret">Secret *</Label>
                <div className="relative">
                  <Input
                    id="secret"
                    type={showPassword ? 'text' : 'password'}
                    value={nasFormData.secret}
                    onChange={(e) => setNasFormData({ ...nasFormData, secret: e.target.value })}
                    placeholder="Enter RADIUS shared secret"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={nasFormData.description}
                  onChange={(e) => setNasFormData({ ...nasFormData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="poolName">IP Pool</Label>
                <Select
                  value={nasFormData.poolName || undefined}
                  onValueChange={(value) => setNasFormData({ ...nasFormData, poolName: value === 'none' ? '' : value })}
                >
                  <SelectTrigger id="poolName">
                    <SelectValue placeholder="Select an IP pool" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {ipPools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.name}>
                        {pool.name} ({pool.startIp} - {pool.endIp})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enabled"
                    checked={nasFormData.enabled}
                    onCheckedChange={(checked) => setNasFormData({ ...nasFormData, enabled: checked })}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="monitor"
                    checked={nasFormData.monitor}
                    onCheckedChange={(checked) => setNasFormData({ ...nasFormData, monitor: checked })}
                  />
                  <Label htmlFor="monitor">Monitor</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ipAccountingEnabled"
                    checked={nasFormData.ipAccountingEnabled}
                    onCheckedChange={(checked) => setNasFormData({ ...nasFormData, ipAccountingEnabled: checked })}
                  />
                  <Label htmlFor="ipAccountingEnabled">IP Accounting</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="network" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coaPort">CoA Port</Label>
                  <Input
                    id="coaPort"
                    type="number"
                    value={nasFormData.coaPort}
                    onChange={(e) => setNasFormData({ ...nasFormData, coaPort: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="httpPort">HTTP Port</Label>
                  <Input
                    id="httpPort"
                    type="number"
                    value={nasFormData.httpPort}
                    onChange={(e) => setNasFormData({ ...nasFormData, httpPort: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sshPort">SSH Port</Label>
                  <Input
                    id="sshPort"
                    type="number"
                    value={nasFormData.sshPort}
                    onChange={(e) => setNasFormData({ ...nasFormData, sshPort: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiPort">API Port</Label>
                  <Input
                    id="apiPort"
                    type="number"
                    value={nasFormData.apiPort}
                    onChange={(e) => setNasFormData({ ...nasFormData, apiPort: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="poolName">Pool Name</Label>
                  <Input
                    id="poolName"
                    value={nasFormData.poolName}
                    onChange={(e) => setNasFormData({ ...nasFormData, poolName: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteId">Site ID</Label>
                  <Input
                    id="siteId"
                    type="number"
                    value={nasFormData.siteId}
                    onChange={(e) => setNasFormData({ ...nasFormData, siteId: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiUsername">API Username</Label>
                  <Input
                    id="apiUsername"
                    value={nasFormData.apiUsername}
                    onChange={(e) => setNasFormData({ ...nasFormData, apiUsername: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiPassword">API Password</Label>
                  <Input
                    id="apiPassword"
                    type="password"
                    value={nasFormData.apiPassword}
                    onChange={(e) => setNasFormData({ ...nasFormData, apiPassword: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sshUsername">SSH Username</Label>
                  <Input
                    id="sshUsername"
                    value={nasFormData.sshUsername}
                    onChange={(e) => setNasFormData({ ...nasFormData, sshUsername: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sshPassword">SSH Password</Label>
                  <Input
                    id="sshPassword"
                    type="password"
                    value={nasFormData.sshPassword}
                    onChange={(e) => setNasFormData({ ...nasFormData, sshPassword: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="snmpCommunity">SNMP Community</Label>
                  <Input
                    id="snmpCommunity"
                    value={nasFormData.snmpCommunity}
                    onChange={(e) => setNasFormData({ ...nasFormData, snmpCommunity: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="server">Server</Label>
                  <Input
                    id="server"
                    value={nasFormData.server}
                    onChange={(e) => setNasFormData({ ...nasFormData, server: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseNasDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveNas} disabled={createNasMutation.isPending || updateNasMutation.isPending}>
              {editingNas ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft delete the NAS device. You can restore it later from the trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore NAS Device?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the NAS device and make it active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
