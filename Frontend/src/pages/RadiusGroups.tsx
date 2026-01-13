import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { 
  Plus, Pencil, Trash2, RefreshCw, Search as SearchIcon, ChevronLeft, ChevronRight, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Archive, Users
} from 'lucide-react'
import { radiusGroupApi, type RadiusGroup } from '@/api/radiusGroupApi'
import { formatApiError } from '@/utils/errorHandler'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function RadiusGroups() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
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
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection])

  // Group state
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<RadiusGroup | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [groupToRestore, setGroupToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)

  // Color and Icon picker state
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6')
  const [newGroupIcon, setNewGroupIcon] = useState('Users')
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)
  const [editIconPopoverOpen, setEditIconPopoverOpen] = useState(false)

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    description: true,
    subscription: true,
    status: true,
    users: true,
    lastSynced: true,
  })

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    subscription: '',
    isActive: true,
    color: '#3b82f6',
    icon: 'Users',
  })

  // Helper function to get icon component

  // Group queries
  const { data: groupsData, isLoading: isLoadingGroups, isFetching, error: groupsError } = useQuery({
    queryKey: ['radius-groups', currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash
      ? radiusGroupApi.getTrash(currentPage, pageSize)
      : radiusGroupApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
  })

  const groups = useMemo(() => groupsData?.data || [], [groupsData?.data])
  const pagination = groupsData?.pagination

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: groups.length,
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

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: any) => radiusGroupApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-groups'] })
      toast.success('Group created successfully')
      setIsGroupDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error('Failed to create group', {
        description: formatApiError(error),
      })
    },
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => radiusGroupApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-groups'] })
      toast.success('Group updated successfully')
      setIsGroupDialogOpen(false)
      setEditingGroup(null)
      resetForm()
    },
    onError: (error) => {
      toast.error('Failed to update group', {
        description: formatApiError(error),
      })
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => radiusGroupApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-groups'] })
      toast.success('Group deleted successfully')
      setDeleteDialogOpen(false)
      setGroupToDelete(null)
    },
    onError: (error) => {
      toast.error('Failed to delete group', {
        description: formatApiError(error),
      })
    },
  })

  const restoreGroupMutation = useMutation({
    mutationFn: (id: number) => radiusGroupApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-groups'] })
      toast.success('Group restored successfully')
      setRestoreDialogOpen(false)
      setGroupToRestore(null)
    },
    onError: (error) => {
      toast.error('Failed to restore group', {
        description: formatApiError(error),
      })
    },
  })

  // Form handlers
  const resetForm = () => {
    setGroupFormData({
      name: '',
      subscription: '',
      isActive: true,
      color: '#3b82f6',
      icon: 'Users',
    })
    setNewGroupColor('#3b82f6')
    setNewGroupIcon('Users')
    setEditingGroup(null)
    setIconPopoverOpen(false)
    setEditIconPopoverOpen(false)
  }

  const handleCreateGroup = () => {
    setEditingGroup(null)
    resetForm()
    setIsGroupDialogOpen(true)
  }

  const handleEditGroup = (group: RadiusGroup) => {
    setEditingGroup(group)
    setGroupFormData({
      name: group.name,
      subscription: group.subscription || '',
      isActive: group.isActive,
      color: group.color || '#3b82f6',
      icon: group.icon || 'Users',
    })
    setNewGroupColor(group.color || '#3b82f6')
    setNewGroupIcon(group.icon || 'Users')
    setIsGroupDialogOpen(true)
  }

  const handleSaveGroup = () => {
    const data = {
      name: groupFormData.name,
      subscription: groupFormData.subscription || undefined,
      isActive: groupFormData.isActive,
      color: editingGroup ? newGroupColor : groupFormData.color,
      icon: editingGroup ? newGroupIcon : groupFormData.icon,
    }

    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id!, data })
    } else {
      createGroupMutation.mutate(data)
    }
  }

  const handleDeleteGroup = (id: number) => {
    setGroupToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      deleteGroupMutation.mutate(groupToDelete)
    }
  }

  const handleRestoreGroup = (id: number) => {
    setGroupToRestore(id)
    setRestoreDialogOpen(true)
  }

  const confirmRestoreGroup = () => {
    if (groupToRestore) {
      restoreGroupMutation.mutate(groupToRestore)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['radius-groups'] })
  }

  // Toggle all columns
  const toggleAllColumns = (visible: boolean) => {
    setColumnVisibility({
      name: visible,
      subscription: visible,
      status: visible,
      users: visible,
    })
  }

  if (groupsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{formatApiError(groupsError)}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">RADIUS Groups</h1>
          <p className="text-sm text-muted-foreground">Manage user groups and subscriptions</p>
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
              placeholder="Search groups..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <SearchIcon className="h-4 w-4" />
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="icon"
              disabled={isFetching}
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
                  checked={Object.values(columnVisibility).every(Boolean)}
                  onCheckedChange={toggleAllColumns}
                >
                  Show All
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={!Object.values(columnVisibility).some(Boolean)}
                  onCheckedChange={() => toggleAllColumns(false)}
                >
                  Hide All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.name}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                >
                  Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.description}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, description: checked }))}
                >
                  Description
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.subscription}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, subscription: checked }))}
                >
                  Subscription
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.status}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.users}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, users: checked }))}
                >
                  Users
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={columnVisibility.lastSynced}
                  onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, lastSynced: checked }))}
                >
                  Last Synced
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button onClick={handleCreateGroup} disabled={showTrash}>
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {isFetching && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
            <div ref={parentRef} className="border rounded-md overflow-auto" style={{ height: '500px' }}>
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-20">
                  <TableRow>
                    {columnVisibility.name && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                        Name{getSortIcon('name')}
                      </TableHead>
                    )}
                    {columnVisibility.description && (
                      <TableHead>Description</TableHead>
                    )}
                    {columnVisibility.subscription && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort('subscription')}>
                        Subscription{getSortIcon('subscription')}
                      </TableHead>
                    )}
                    {columnVisibility.status && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort('isActive')}>
                        Status{getSortIcon('isActive')}
                      </TableHead>
                    )}
                    {columnVisibility.users && (
                      <TableHead className="cursor-pointer" onClick={() => handleSort('userCount')}>
                        Users{getSortIcon('userCount')}
                      </TableHead>
                    )}
                    {columnVisibility.lastSynced && (
                      <TableHead>Last Synced</TableHead>
                    )}
                    <TableHead className="text-right sticky right-0 bg-muted">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingGroups ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <TableRow key={index}>
                        {columnVisibility.name && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                        {columnVisibility.description && <TableCell><Skeleton className="h-4 w-48" /></TableCell>}
                        {columnVisibility.subscription && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                        {columnVisibility.status && <TableCell><Skeleton className="h-6 w-16" /></TableCell>}
                        {columnVisibility.users && <TableCell><Skeleton className="h-4 w-12" /></TableCell>}
                        {columnVisibility.lastSynced && <TableCell><Skeleton className="h-4 w-32" /></TableCell>}
                        <TableCell className="text-right sticky right-0 bg-card">
                          <Skeleton className="h-8 w-20 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="p-0">
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="rounded-full bg-muted p-6 mb-4">
                            <Users className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">
                            {showTrash ? 'No deleted groups' : 'No groups yet'}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            {showTrash ? 'Deleted groups will appear here' : 'Get started by adding your first group'}
                          </p>
                          {!showTrash && (
                            <Button onClick={handleCreateGroup}>
                              <Plus className="mr-2 h-4 w-4" />
                              Add Group
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const group = groups[virtualRow.index]
                      const GroupIcon = getIconComponent(group.icon)
                      return (
                        <TableRow key={group.id} style={{ height: `${virtualRow.size}px` }}>
                          {columnVisibility.name && (
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="rounded-lg p-1.5 flex items-center justify-center"
                                  style={{ backgroundColor: `${group.color || '#3b82f6'}15`, color: group.color || '#3b82f6' }}
                                >
                                  <GroupIcon className="h-4 w-4" />
                                </div>
                                {group.name}
                                {group.externalId && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    SAS ID: {group.externalId}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {columnVisibility.description && (
                            <TableCell className="max-w-xs truncate" title={group.description}>
                              {group.description || '-'}
                            </TableCell>
                          )}
                          {columnVisibility.subscription && <TableCell>{group.subscription || '-'}</TableCell>}
                          {columnVisibility.status && (
                            <TableCell>
                              <Badge variant={group.isActive ? 'default' : 'secondary'}>
                                {group.isActive ? 'Active' : 'Disabled'}
                              </Badge>
                            </TableCell>
                          )}
                          {columnVisibility.users && <TableCell>{group.usersCount || 0}</TableCell>}
                          {columnVisibility.lastSynced && (
                            <TableCell>
                              {group.lastSyncedAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {new Date(group.lastSyncedAt).toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right sticky right-0 bg-card">
                            {showTrash ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestoreGroup(group.id!)}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restore
                              </Button>
                            ) : (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditGroup(group)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteGroup(group.id!)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Enhanced Pagination */}
          {pagination && pagination.totalPages > 0 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalRecords)} of {pagination.totalRecords} groups
              </div>
              <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(parseInt(value)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[100px]">
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
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getPaginationPages(currentPage, pagination.totalPages).map((page, index) => (
                    page === '...' ? (
                      <Button key={`ellipsis-${index}`} variant="outline" size="sm" disabled>
                        ...
                      </Button>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page as number)}
                      >
                        {page}
                      </Button>
                    )
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      {isGroupDialogOpen && (
        <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
              <DialogDescription>
                {editingGroup ? 'Update the group details' : 'Add a new RADIUS group'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="e.g., VIP Members, Premium Users, Corporate Access"
                  className="h-10"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subscription" className="text-sm font-medium">Subscription</Label>
                <Input
                  id="subscription"
                  value={groupFormData.subscription}
                  onChange={(e) => setGroupFormData({ ...groupFormData, subscription: e.target.value })}
                  placeholder="Subscription type (optional)"
                  className="h-10"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                  <Select 
                    value={editingGroup ? newGroupColor : groupFormData.color} 
                    onValueChange={(value) => {
                      if (editingGroup) {
                        setNewGroupColor(value)
                      } else {
                        setGroupFormData({ ...groupFormData, color: value })
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: editingGroup ? newGroupColor : groupFormData.color }}
                        />
                        <span>
                          {PREDEFINED_COLORS.find(c => c.value === (editingGroup ? newGroupColor : groupFormData.color))?.label || 'Select Color'}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: color.value }}
                            />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="flex items-center h-10 px-3 border rounded-md">
                    <Label htmlFor="isActive" className="flex-1 cursor-pointer">Active</Label>
                    <Switch
                      id="isActive"
                      checked={groupFormData.isActive}
                      onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isActive: checked })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon" className="text-sm font-medium">Icon</Label>
                <Popover 
                  open={editingGroup ? editIconPopoverOpen : iconPopoverOpen} 
                  onOpenChange={editingGroup ? setEditIconPopoverOpen : setIconPopoverOpen}
                  modal={true}
                >
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start h-10" 
                      type="button"
                    >
                      {(() => {
                        const SelectedIcon = getIconComponent(editingGroup ? newGroupIcon : groupFormData.icon)
                        return <SelectedIcon className="w-4 h-4 mr-2" />
                      })()}
                      {editingGroup ? newGroupIcon : groupFormData.icon}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-80 p-0" 
                    align="start"
                    style={{ zIndex: 9999 }}
                    sideOffset={5}
                  >
                    <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                      {AVAILABLE_ICONS.map((iconData) => {
                        const IconComponent = iconData.icon
                        const isSelected = (editingGroup ? newGroupIcon : groupFormData.icon) === iconData.name
                        return (
                          <button
                            key={iconData.name}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (editingGroup) {
                                setNewGroupIcon(iconData.name)
                                setEditIconPopoverOpen(false)
                              } else {
                                setGroupFormData({ ...groupFormData, icon: iconData.name })
                                setIconPopoverOpen(false)
                              }
                            }}
                            className={`p-2 rounded flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                            style={{
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            title={iconData.name}
                          >
                            <IconComponent className="w-4 h-4" />
                          </button>
                        )
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsGroupDialogOpen(false)}
                className="gap-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveGroup} 
                disabled={!groupFormData.name}
                className="gap-2"
              >
                {editingGroup ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    Update Group
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Group
                  </>
                )}
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
              This will move the group to trash. You can restore it later from the trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the group and make it active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestoreGroup}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
