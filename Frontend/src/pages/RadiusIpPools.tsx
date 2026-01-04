import { useState, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, 
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react'
import { radiusIpPoolApi, type RadiusIpPool } from '@/api/radiusIpPoolApi'
import { formatApiError } from '@/utils/errorHandler'

export default function RadiusIpPoolsPage() {
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

  // IP Pool state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPool, setEditingPool] = useState<RadiusIpPool | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [poolToDelete, setPoolToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [poolToRestore, setPoolToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    start_ip: '',
    end_ip: '',
    lease_time: '24',
  })

  // IP Pool queries
  const { data: poolData, isLoading, isFetching, error } = useQuery({
    queryKey: ['radius-ip-pools', workspaceId, currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash
      ? radiusIpPoolApi.getTrash(workspaceId, currentPage, pageSize)
      : radiusIpPoolApi.getAll(workspaceId, currentPage, pageSize, searchQuery, sortField, sortDirection),
    enabled: workspaceId > 0,
  })

  const ipPools = poolData?.data || []
  const pagination = poolData?.pagination

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

  // IP Pool mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => radiusIpPoolApi.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-pools', workspaceId] })
      toast.success('IP Pool created successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create IP Pool')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusIpPoolApi.update(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-pools', workspaceId] })
      toast.success('IP Pool updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update IP Pool')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => radiusIpPoolApi.delete(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-pools', workspaceId] })
      toast.success('IP Pool deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete IP Pool')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => radiusIpPoolApi.restore(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-ip-pools', workspaceId] })
      toast.success('IP Pool restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore IP Pool')
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

  const handleOpenDialog = (pool?: RadiusIpPool) => {
    if (pool) {
      setEditingPool(pool)
      setFormData({
        name: pool.name || '',
        start_ip: pool.startIp || '',
        end_ip: pool.endIp || '',
        lease_time: pool.leaseTime?.toString() || '24',
      })
    } else {
      setEditingPool(null)
      setFormData({
        name: '',
        start_ip: '',
        end_ip: '',
        lease_time: '24',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingPool(null)
  }

  const handleSave = () => {
    if (!formData.name) {
      toast.error('Pool name is required')
      return
    }
    if (!formData.start_ip) {
      toast.error('Start IP is required')
      return
    }
    if (!formData.end_ip) {
      toast.error('End IP is required')
      return
    }

    const data = {
      name: formData.name,
      startIp: formData.start_ip,
      endIp: formData.end_ip,
      leaseTime: parseInt(formData.lease_time),
    }

    if (editingPool && editingPool.id) {
      updateMutation.mutate({ id: editingPool.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id?: number) => {
    if (id) {
      setPoolToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (poolToDelete) {
      deleteMutation.mutate(poolToDelete)
      setDeleteDialogOpen(false)
      setPoolToDelete(null)
    }
  }

  const handleRestore = (id?: number) => {
    if (id) {
      setPoolToRestore(id)
      setRestoreDialogOpen(true)
    }
  }

  const confirmRestore = () => {
    if (poolToRestore) {
      restoreMutation.mutate(poolToRestore)
      setRestoreDialogOpen(false)
      setPoolToRestore(null)
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
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
          <h1 className="text-3xl font-bold">RADIUS IP Pools</h1>
          <p className="text-muted-foreground">
            Manage IP address pools for RADIUS authentication
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
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add IP Pool
            </Button>
          )}
        </div>
      </div>

      {/* Main Card */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder="Search IP pools..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} variant="outline" size="icon">
                <Search className="h-4 w-4" />
              </Button>
              <Button 
                onClick={() => queryClient.invalidateQueries({ queryKey: ['radius-ip-pools', workspaceId] })} 
                variant="outline" 
                size="icon"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
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
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                    Pool Name {getSortIcon('name')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('start_ip')}>
                    Start IP {getSortIcon('start_ip')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('end_ip')}>
                    End IP {getSortIcon('end_ip')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('lease_time')}>
                    Lease Time (hours) {getSortIcon('lease_time')}
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('created_at')}>
                    Created {getSortIcon('created_at')}
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isFetching ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : ipPools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {showTrash ? 'No deleted IP pools found' : 'No IP pools found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  ipPools.map((pool) => (
                    <TableRow key={pool.id}>
                      <TableCell className="font-medium">{pool.name}</TableCell>
                      <TableCell>{pool.startIp}</TableCell>
                      <TableCell>{pool.endIp}</TableCell>
                      <TableCell>{pool.leaseTime}</TableCell>
                      <TableCell>
                        {pool.createdAt ? new Date(pool.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {showTrash ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(pool.id)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(pool)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(pool.id)}
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
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalRecords)} of {pagination.totalRecords} IP pools
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPaginationPages(currentPage, pagination.totalPages).map((page, idx) => (
                  typeof page === 'number' ? (
                    <Button
                      key={idx}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ) : (
                    <span key={idx} className="px-2">...</span>
                  )
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPool ? 'Edit IP Pool' : 'Add IP Pool'}</DialogTitle>
            <DialogDescription>
              {editingPool ? 'Update the IP pool details' : 'Create a new IP address pool'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pool Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Public Pool, Private Pool"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_ip">Start IP *</Label>
                <Input
                  id="start_ip"
                  value={formData.start_ip}
                  onChange={(e) => setFormData({ ...formData, start_ip: e.target.value })}
                  placeholder="192.168.1.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_ip">End IP *</Label>
                <Input
                  id="end_ip"
                  value={formData.end_ip}
                  onChange={(e) => setFormData({ ...formData, end_ip: e.target.value })}
                  placeholder="192.168.1.100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lease_time">Lease Time (hours) *</Label>
              <Input
                id="lease_time"
                type="number"
                value={formData.lease_time}
                onChange={(e) => setFormData({ ...formData, lease_time: e.target.value })}
                placeholder="24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingPool ? 'Update' : 'Create'}
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
              This will move the IP pool to trash. You can restore it later from the trash.
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
            <AlertDialogTitle>Restore IP Pool?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the IP pool and make it available again.
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
