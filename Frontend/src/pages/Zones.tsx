import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Plus, Pencil, Trash2, Users, Radio, RefreshCw, Search, ChevronLeft, ChevronRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { zoneApi, type Zone, type ZoneCreateDto, type ZoneUpdateDto } from '@/services/zoneApi'
import { formatApiError } from '@/utils/errorHandler'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function Zones() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'))
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || 'name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')

  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    description: true,
    color: true,
    userCount: true,
    radiusUserCount: true,
    createdAt: true,
  })

  const [formData, setFormData] = useState<ZoneCreateDto>({
    name: '',
    description: '',
    color: '#3b82f6',
  })

  const workspaceIdNum = parseInt(workspaceId || '0')

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField !== 'name') params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  const { data: zonesData = [], isLoading, refetch } = useQuery({
    queryKey: ['zones', workspaceIdNum, searchQuery, sortField, sortDirection],
    queryFn: async () => {
      const data = await zoneApi.getZones(workspaceIdNum)
      
      // Filter
      let filtered = data
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = data.filter(zone => 
          zone.name.toLowerCase().includes(query) ||
          (zone.description?.toLowerCase() || '').includes(query)
        )
      }

      // Sort
      if (sortField) {
        filtered.sort((a, b) => {
          const aVal = a[sortField as keyof Zone]
          const bVal = b[sortField as keyof Zone]
          
          if (aVal === null || aVal === undefined) return 1
          if (bVal === null || bVal === undefined) return -1
          
          let comparison = 0
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal)
          } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal
          }
          
          return sortDirection === 'asc' ? comparison : -comparison
        })
      }

      return filtered
    },
    enabled: !!workspaceIdNum,
  })

  // Pagination
  const totalRecords = zonesData.length
  const totalPages = Math.ceil(totalRecords / pageSize)
  const paginatedZones = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return zonesData.slice(start, end)
  }, [zonesData, currentPage, pageSize])

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: paginatedZones.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ZoneCreateDto) => zoneApi.createZone(workspaceIdNum, data),
    onSuccess: () => {
      toast.success('Zone created successfully')
      setCreateDialogOpen(false)
      setFormData({ name: '', description: '', color: '#3b82f6' })
      queryClient.invalidateQueries({ queryKey: ['zones', workspaceIdNum] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create zone')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ZoneUpdateDto }) =>
      zoneApi.updateZone(workspaceIdNum, id, data),
    onSuccess: () => {
      toast.success('Zone updated successfully')
      setEditDialogOpen(false)
      setSelectedZone(null)
      queryClient.invalidateQueries({ queryKey: ['zones', workspaceIdNum] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update zone')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => zoneApi.deleteZone(workspaceIdNum, id),
    onSuccess: () => {
      toast.success('Zone deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedZone(null)
      queryClient.invalidateQueries({ queryKey: ['zones', workspaceIdNum] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete zone')
    },
  })

  // Handlers
  const handleCreate = () => {
    setFormData({ name: '', description: '', color: '#3b82f6' })
    setCreateDialogOpen(true)
  }

  const handleEdit = (zone: Zone) => {
    setSelectedZone(zone)
    setFormData({
      name: zone.name,
      description: zone.description || '',
      color: zone.color || '#3b82f6',
    })
    setEditDialogOpen(true)
  }

  const handleDelete = (zone: Zone) => {
    setSelectedZone(zone)
    setDeleteDialogOpen(true)
  }

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate(formData)
  }

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedZone) {
      updateMutation.mutate({
        id: selectedZone.id,
        data: formData,
      })
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    parentRef.current?.scrollTo({ top: 0 })
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Zones</h1>
          <p className="text-muted-foreground">Manage billing zones and assign users</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refetch} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Zone
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                All Zones
              </CardTitle>
              <CardDescription>
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} zones
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search zones..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-8 w-64"
                  />
                </div>
                <Button onClick={handleSearch} size="sm">
                  Search
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.name}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.description}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, description: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Description
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.color}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, color: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Color
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.userCount}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, userCount: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Users
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.radiusUserCount}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, radiusUserCount: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Radius Users
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={columnVisibility.createdAt}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, createdAt: checked }))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Created
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden relative">
          {isLoading ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 452px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="h-12 px-4 w-[200px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[300px]"><Skeleton className="h-4 w-24" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-24" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="sticky right-0 bg-background h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : paginatedZones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No zones found</p>
              <p className="text-sm">
                {searchQuery ? 'Try adjusting your search criteria' : 'Create your first zone to get started'}
              </p>
            </div>
          ) : (
            <>
              <div
                ref={parentRef}
                className="overflow-auto"
                style={{ maxHeight: 'calc(100vh - 452px)' }}
              >
                <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      {columnVisibility.name && (
                        <TableHead className="h-12 px-4 w-[200px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort('name')}
                          >
                            <span>Name</span>
                            {getSortIcon('name')}
                          </Button>
                        </TableHead>
                      )}
                      {columnVisibility.description && (
                        <TableHead className="h-12 px-4 w-[300px]">Description</TableHead>
                      )}
                      {columnVisibility.color && (
                        <TableHead className="h-12 px-4 w-[100px]">Color</TableHead>
                      )}
                      {columnVisibility.userCount && (
                        <TableHead className="h-12 px-4 w-[120px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort('userCount')}
                          >
                            <span>Users</span>
                            {getSortIcon('userCount')}
                          </Button>
                        </TableHead>
                      )}
                      {columnVisibility.radiusUserCount && (
                        <TableHead className="h-12 px-4 w-[140px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort('radiusUserCount')}
                          >
                            <span>Radius Users</span>
                            {getSortIcon('radiusUserCount')}
                          </Button>
                        </TableHead>
                      )}
                      {columnVisibility.createdAt && (
                        <TableHead className="h-12 px-4 w-[140px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 data-[state=open]:bg-accent"
                            onClick={() => handleSort('createdAt')}
                          >
                            <span>Created</span>
                            {getSortIcon('createdAt')}
                          </Button>
                        </TableHead>
                      )}
                      <TableHead className="sticky right-0 bg-background h-12 px-4 w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const zone = paginatedZones[virtualRow.index]
                      return (
                        <TableRow
                          key={zone.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {columnVisibility.name && (
                            <TableCell className="px-4 font-medium">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: zone.color || '#3b82f6' }}
                                />
                                <span className="truncate">{zone.name}</span>
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.description && (
                            <TableCell className="px-4 text-sm text-muted-foreground">
                              <span className="truncate block">{zone.description || '-'}</span>
                            </TableCell>
                          )}
                          {columnVisibility.color && (
                            <TableCell className="px-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-6 w-6 rounded border"
                                  style={{ backgroundColor: zone.color || '#3b82f6' }}
                                />
                                <span className="text-xs text-muted-foreground">{zone.color}</span>
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.userCount && (
                            <TableCell className="px-4">
                              <Badge variant="secondary" className="gap-1">
                                <Users className="h-3 w-3" />
                                {zone.userCount}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.radiusUserCount && (
                            <TableCell className="px-4">
                              <Badge variant="secondary" className="gap-1">
                                <Radio className="h-3 w-3" />
                                {zone.radiusUserCount}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.createdAt && (
                            <TableCell className="px-4 text-sm">{formatDate(zone.createdAt)}</TableCell>
                          )}
                          <TableCell className="sticky right-0 bg-background px-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(zone)}
                                title="Edit zone"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(zone)}
                                title="Delete zone"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} zones
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="w-9"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Zone Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Zone</DialogTitle>
            <DialogDescription>
              Add a new zone to organize your users and radius users
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., North Region"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Zone Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <DialogDescription>Update zone information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., North Region"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update Zone'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the zone <strong>{selectedZone?.name}</strong>?
              <p className="mt-2">
                This will remove zone assignments from all radius users. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedZone && deleteMutation.mutate(selectedZone.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Zone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
