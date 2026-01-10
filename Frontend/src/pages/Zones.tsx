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
import { Checkbox } from '@/components/ui/checkbox'
import { MapPin, Plus, Pencil, Trash2, Users, Radio, RefreshCw, Search, ChevronLeft, ChevronRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown, UserPlus } from 'lucide-react'
import { zoneApi, type Zone, type ZoneCreateDto, type ZoneUpdateDto } from '@/services/zoneApi'
import { userManagementApi, type User } from '@/api/userManagementApi'
import { formatApiError } from '@/utils/errorHandler'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  const [assignUsersDialogOpen, setAssignUsersDialogOpen] = useState(false)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')

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

  // Fetch all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementApi.getAll(),
  })

  // Fetch zone users when dialog opens
  const { data: zoneUserIds = [], refetch: refetchZoneUsers } = useQuery({
    queryKey: ['zone-users', selectedZone?.id],
    queryFn: () => selectedZone ? zoneApi.getZoneUsers(workspaceIdNum, selectedZone.id) : Promise.resolve([]),
    enabled: !!selectedZone && assignUsersDialogOpen,
  })

  // Filter users for assignment dialog
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return allUsers
    const query = userSearchQuery.toLowerCase()
    return allUsers.filter(user =>
      user.email?.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query)
    )
  }, [allUsers, userSearchQuery])

  // Set selected users when dialog opens
  useEffect(() => {
    if (assignUsersDialogOpen && zoneUserIds) {
      setSelectedUserIds(zoneUserIds)
    }
  }, [assignUsersDialogOpen, zoneUserIds])

  const totalRecords = zonesData.length
  const paginatedZones = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return zonesData.slice(startIndex, startIndex + pageSize)
  }, [zonesData, currentPage, pageSize])

  const totalPages = Math.ceil(totalRecords / pageSize)

  const rowVirtualizer = useVirtualizer({
    count: paginatedZones.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 57,
    overscan: 10,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ZoneCreateDto) => zoneApi.createZone(workspaceIdNum, data),
    onSuccess: () => {
      toast.success('Zone created successfully')
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      setCreateDialogOpen(false)
      setFormData({ name: '', description: '', color: '#3b82f6' })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ZoneUpdateDto }) =>
      zoneApi.updateZone(workspaceIdNum, id, data),
    onSuccess: () => {
      toast.success('Zone updated successfully')
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      setEditDialogOpen(false)
      setSelectedZone(null)
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => zoneApi.deleteZone(workspaceIdNum, id),
    onSuccess: () => {
      toast.success('Zone deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      setDeleteDialogOpen(false)
      setSelectedZone(null)
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const assignUsersMutation = useMutation({
    mutationFn: ({ zoneId, userIds }: { zoneId: number; userIds: string[] }) =>
      zoneApi.assignUsersToZone(workspaceIdNum, zoneId, { userIds }),
    onSuccess: () => {
      toast.success('Users assigned successfully')
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['zone-users'] })
      setAssignUsersDialogOpen(false)
      setSelectedZone(null)
      setSelectedUserIds([])
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const handleCreate = () => {
    setFormData({ name: '', description: '', color: '#3b82f6' })
    setCreateDialogOpen(true)
  }

  const handleEdit = (zone: Zone) => {
    setSelectedZone(zone)
    setFormData({
      name: zone.name,
      description: zone.description,
      color: zone.color || '#3b82f6',
    })
    setEditDialogOpen(true)
  }

  const handleDelete = (zone: Zone) => {
    setSelectedZone(zone)
    setDeleteDialogOpen(true)
  }

  const handleAssignUsers = async (zone: Zone) => {
    setSelectedZone(zone)
    setUserSearchQuery('')
    setAssignUsersDialogOpen(true)
    await refetchZoneUsers()
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

  const handleSubmitAssignUsers = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedZone) {
      assignUsersMutation.mutate({
        zoneId: selectedZone.id,
        userIds: selectedUserIds,
      })
    }
  }

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
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
                  {Object.entries(columnVisibility).map(([key, value]) => (
                    <DropdownMenuCheckboxItem
                      key={key}
                      checked={value}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, [key]: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div ref={parentRef} className="h-[600px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      {columnVisibility.name && (
                        <TableHead className="h-12 px-4 w-[200px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            onClick={() => handleSort('name')}
                          >
                            <span>Name</span>
                            {getSortIcon('name')}
                          </Button>
                        </TableHead>
                      )}
                      {columnVisibility.description && (
                        <TableHead className="h-12 px-4">Description</TableHead>
                      )}
                      {columnVisibility.color && (
                        <TableHead className="h-12 px-4 w-[150px]">Color</TableHead>
                      )}
                      {columnVisibility.userCount && (
                        <TableHead className="h-12 px-4 w-[120px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
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
                            className="-ml-3 h-8"
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
                            className="-ml-3 h-8"
                            onClick={() => handleSort('createdAt')}
                          >
                            <span>Created</span>
                            {getSortIcon('createdAt')}
                          </Button>
                        </TableHead>
                      )}
                      <TableHead className="sticky right-0 bg-background h-12 px-4 w-[160px]">Actions</TableHead>
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
                                onClick={() => handleAssignUsers(zone)}
                                title="Assign users"
                              >
                                <UserPlus className="h-4 w-4" />
                              </Button>
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
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(e.target.value)}
                    className="h-8 w-16 rounded border bg-background px-2"
                  >
                    {[10, 20, 50, 100, 200].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
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
            <DialogTitle>Create Zone</DialogTitle>
            <DialogDescription>Add a new billing zone</DialogDescription>
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

      {/* Assign Users Dialog */}
      <Dialog open={assignUsersDialogOpen} onOpenChange={setAssignUsersDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Users to Zone</DialogTitle>
            <DialogDescription>
              Select multiple users to assign to <strong>{selectedZone?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAssignUsers}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="border rounded-md h-[400px] overflow-y-auto">
                <div className="p-2 space-y-1">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user.keycloakUserId || user.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                        onClick={() => handleToggleUser(user.keycloakUserId || user.id.toString())}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.keycloakUserId || user.id.toString())}
                          onCheckedChange={() => handleToggleUser(user.keycloakUserId || user.id.toString())}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{selectedUserIds.length} user(s) selected</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedUserIds([])}
                  disabled={selectedUserIds.length === 0}
                >
                  Clear selection
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignUsersDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assignUsersMutation.isPending}>
                {assignUsersMutation.isPending ? 'Assigning...' : 'Assign Users'}
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
