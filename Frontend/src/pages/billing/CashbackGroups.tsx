import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, RefreshCw, Search, Archive, RotateCcw, UsersRound, Users, Palette, Settings } from 'lucide-react'
import { cashbackGroupApi, type CashbackGroup } from '@/api/cashbackGroupApi'
import { userManagementApi } from '@/api/userManagementApi'
import { userCashbackApi } from '@/api/userCashbackApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { AVAILABLE_ICONS, PREDEFINED_COLORS, getIconComponent } from '@/utils/iconColorHelper'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export default function CashbackGroups() {
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
  const [showTrash, setShowTrash] = useState(false)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<CashbackGroup | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [groupToRestore, setGroupToRestore] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    icon: 'Gift',
    color: '#3b82f6',
    disabled: false,
    userIds: [] as number[]
  })

  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false)
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)
  const [assignedUserIds, setAssignedUserIds] = useState<Record<number, number>>({})

  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection])

  const { data: groupsData, isLoading, isFetching } = useQuery({
    queryKey: ['cashback-groups', currentWorkspaceId, currentPage, pageSize, searchQuery, sortField, sortDirection, showTrash],
    queryFn: () => cashbackGroupApi.getAll({
      page: currentPage,
      pageSize,
      search: searchQuery,
      sortField,
      sortDirection,
      onlyDeleted: showTrash
    }),
    enabled: !!currentWorkspaceId,
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementApi.getAll(),
  })

  // Fetch user IDs that have individual cashback settings
  const { data: userIdsWithCashbacks, refetch: refetchUserCashbackIds } = useQuery({
    queryKey: ['user-cashback-ids', currentWorkspaceId],
    queryFn: () => userCashbackApi.getUserIdsWithCashbacks(),
    enabled: !!currentWorkspaceId,
  })

  // Fetch all active groups to track user assignments
  const { data: allGroupsData } = useQuery({
    queryKey: ['cashback-groups-all', currentWorkspaceId],
    queryFn: async () => {
      const result = await cashbackGroupApi.getAll({
        page: 1,
        pageSize: 1000,
        onlyDeleted: false
      })
      return result.data
    },
    enabled: !!currentWorkspaceId,
  })

  // Build a map of userId -> groupId for users already assigned
  useEffect(() => {
    if (!allGroupsData) return
    
    const fetchAllAssignments = async () => {
      const assignments: Record<number, number> = {}
      
      for (const group of allGroupsData) {
        try {
          const userIds = await cashbackGroupApi.getGroupUsers(group.id)
          userIds.forEach(userId => {
            assignments[userId] = group.id
          })
        } catch (error) {
          console.error(`Error fetching users for group ${group.id}:`, error)
        }
      }
      
      setAssignedUserIds(assignments)
    }
    
    fetchAllAssignments()
  }, [allGroupsData])

  const groups = useMemo(() => groupsData?.data || [], [groupsData])
  const pagination = groupsData?.pagination
  const users = useMemo(() => usersData || [], [usersData])
  
  // Show all users but mark those with individual cashbacks or assigned to other groups
  const availableUsers = useMemo(() => {
    return users.map(user => {
      const assignedGroupId = assignedUserIds[user.id]
      const hasIndividualCashback = userIdsWithCashbacks?.includes(user.id) || false
      const isInOtherGroup = assignedGroupId && (!editingGroup || assignedGroupId !== editingGroup.id)
      
      return {
        ...user,
        hasIndividualCashback,
        isDisabled: hasIndividualCashback || isInOtherGroup,
        disabledReason: hasIndividualCashback 
          ? 'Has individual cashback settings' 
          : isInOtherGroup 
            ? `Already in another group` 
            : undefined
      }
    })
  }, [users, assignedUserIds, editingGroup, userIdsWithCashbacks])

  const rowVirtualizer = useVirtualizer({
    count: groups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => cashbackGroupApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-groups', currentWorkspaceId] })
      toast.success('Cashback group created successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => cashbackGroupApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-groups', currentWorkspaceId] })
      toast.success('Cashback group updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => cashbackGroupApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-groups', currentWorkspaceId] })
      toast.success('Cashback group moved to trash')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => cashbackGroupApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-groups', currentWorkspaceId] })
      toast.success('Cashback group restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  const handleOpenDialog = async (group?: CashbackGroup) => {
    // Refetch user cashback IDs to get the latest data
    await refetchUserCashbackIds()
    
    if (group) {
      setEditingGroup(group)
      // Fetch group users
      try {
        const userIds = await cashbackGroupApi.getGroupUsers(group.id)
        
        // Get fresh cashback IDs data
        const freshCashbackIds = await userCashbackApi.getUserIdsWithCashbacks()
        
        // Filter out users who now have individual cashback settings
        const validUserIds = userIds.filter(userId => 
          !freshCashbackIds?.includes(userId)
        )
        
        // Show warning if some users were filtered out
        if (validUserIds.length < userIds.length) {
          toast.warning(
            `${userIds.length - validUserIds.length} user(s) removed from group due to individual cashback settings`,
            { duration: 5000 }
          )
        }
        
        setSelectedUserIds(validUserIds)
        setFormData({
          name: group.name,
          icon: group.icon || 'Gift',
          color: group.color || '#3b82f6',
          disabled: group.disabled,
          userIds: validUserIds
        })
      } catch (error) {
        toast.error('Failed to load group users')
      }
    } else {
      setEditingGroup(null)
      setSelectedUserIds([])
      setFormData({
        name: '',
        icon: 'Gift',
        color: '#3b82f6',
        disabled: false,
        userIds: []
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingGroup(null)
    setSelectedUserIds([])
  }

  const handleSave = async () => {
    const data = {
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      disabled: formData.disabled,
      userIds: selectedUserIds
    }

    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id: number) => {
    setGroupToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteMutation.mutate(groupToDelete)
      setDeleteDialogOpen(false)
      setGroupToDelete(null)
    }
  }

  const handleRestore = (id: number) => {
    setGroupToRestore(id)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (groupToRestore) {
      restoreMutation.mutate(groupToRestore)
      setRestoreDialogOpen(false)
      setGroupToRestore(null)
    }
  }

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllFilteredUsers = () => {
    const filteredUserIds = availableUsers
      .filter(u => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase()
        return fullName.includes(userSearch.toLowerCase())
      })
      .map(u => u.id)
    setSelectedUserIds(filteredUserIds)
  }

  const clearUserSelection = () => {
    setSelectedUserIds([])
  }

  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      if (current <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      } else if (current >= total - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = total - 4; i <= total; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = current - 1; i <= current + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(total)
      }
    }
    
    return pages
  }, [])

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cashback Groups</h1>
          <p className="text-sm text-muted-foreground">Manage cashback groups and user assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
            <TabsList>
              <TabsTrigger value="active">
                <UsersRound className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="trash">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search cashback groups..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['cashback-groups', currentWorkspaceId] })} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={showTrash}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>

      <Tabs value={showTrash ? 'trash' : 'active'} onValueChange={(value) => setShowTrash(value === 'trash')}>
        <TabsContent value={showTrash ? 'trash' : 'active'} className="mt-0">
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-hidden relative">
              {isLoading ? (
                <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      <TableRow>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-24" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="sticky right-0 bg-background h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="sticky right-0 bg-background h-12 px-4">
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
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <UsersRound className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Cashback Groups Yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Get started by adding your first cashback group</p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Group
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
                        <TableHead className="h-12 px-4 cursor-pointer w-[400px]" onClick={() => handleSort('name')}>
                          Name
                        </TableHead>
                        <TableHead className="h-12 px-4 cursor-pointer w-[120px]" onClick={() => handleSort('disabled')}>
                          Status
                        </TableHead>
                        <TableHead className="h-12 px-4 cursor-pointer w-[150px]" onClick={() => handleSort('usercount')}>
                          Users
                        </TableHead>
                        <TableHead className="sticky right-0 bg-muted z-10 h-12 px-4 w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    
                    <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const group = groups[virtualRow.index]
                        const IconComponent = getIconComponent(group.icon || 'Gift')
                        return (
                          <TableRow 
                            key={group.id}
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
                            <TableCell className="px-4 w-[400px]">
                              <div className="flex items-center gap-2">
                                {IconComponent && (
                                  <IconComponent className="h-5 w-5" style={{ color: group.color || '#3b82f6' }} />
                                )}
                                <span>{group.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 w-[120px]">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                group.disabled ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {group.disabled ? 'Disabled' : 'Active'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 w-[150px]">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{group.userCount}</span>
                              </div>
                            </TableCell>
                            <TableCell className="sticky right-0 bg-background z-10 px-4 w-[140px]">
                              <div className="flex justify-end gap-2">
                                {showTrash ? (
                                  <Button variant="outline" size="sm" onClick={() => handleRestore(group.id)}>
                                    <RotateCcw className="h-4 w-4 mr-1" />
                                    Restore
                                  </Button>
                                ) : (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(group)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleDelete(group.id)}>
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
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-sm text-muted-foreground font-medium">
                      Showing {groups.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + groups.length} of {pagination.totalRecords} groups
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    {getPaginationPages(currentPage, pagination.totalPages).map((page, idx) => (
                      page === '...' ? (
                        <Button key={`ellipsis-${idx}`} variant="ghost" size="sm" disabled>
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
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(pagination.totalPages)}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Edit Cashback Group' : 'Add Cashback Group'}</DialogTitle>
              <DialogDescription>
                {editingGroup ? 'Update the cashback group details below' : 'Fill in the details to create a new cashback group'}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-1">
              <div className="space-y-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Assigned Users ({selectedUserIds.length})</h3>
                  </div>

                  {selectedUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedUserIds.map(userId => {
                        const user = users.find(u => u.id === userId)
                        if (!user) return null
                        return (
                          <div key={userId} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm">
                            <span>{user.firstName} {user.lastName}</span>
                            <button
                              onClick={() => toggleUserSelection(userId)}
                              className="hover:bg-primary/20 rounded-full p-0.5"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        {selectedUserIds.length === 0 ? 'Select users' : `${selectedUserIds.length} user(s) selected - Click to modify`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px]" align="start">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Search users..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="flex-1"
                          />
                          <Button size="sm" variant="outline" onClick={selectAllFilteredUsers}>
                            Select All
                          </Button>
                          <Button size="sm" variant="outline" onClick={clearUserSelection}>
                            Clear
                          </Button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                          {availableUsers
                            .filter(u => {
                              const fullName = `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase()
                              return fullName.includes(userSearch.toLowerCase())
                            })
                            .map(user => (
                              <div key={user.id} className={cn(
                                "flex items-center space-x-2 p-2 rounded",
                                user.isDisabled && "bg-muted/50"
                              )}>
                                <Checkbox
                                  id={`user-${user.id}`}
                                  checked={selectedUserIds.includes(user.id)}
                                  onCheckedChange={() => !user.isDisabled && toggleUserSelection(user.id)}
                                  disabled={user.isDisabled}
                                />
                                <Label 
                                  htmlFor={`user-${user.id}`} 
                                  className={cn(
                                    "flex-1 flex items-center gap-2",
                                    user.isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                  )}
                                  title={user.disabledReason}
                                >
                                  {user.hasIndividualCashback && (
                                    <Settings className="h-4 w-4 text-orange-500" />
                                  )}
                                  <span>{user.firstName} {user.lastName} ({user.email})</span>
                                  {user.hasIndividualCashback && (
                                    <span className="text-xs text-orange-500 ml-auto">Individual settings</span>
                                  )}
                                </Label>
                              </div>
                            ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <UsersRound className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Group Details</h3>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., VIP Customers"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Icon</Label>
                    <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-start">
                          {(() => {
                            const IconComp = getIconComponent(formData.icon)
                            return IconComp ? <IconComp className="h-4 w-4 mr-2" /> : null
                          })()}
                          {formData.icon}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px]">
                        <div className="grid grid-cols-6 gap-2">
                          {AVAILABLE_ICONS.map((iconData) => {
                            const IconComp = iconData.icon
                            return (
                              <Button
                                key={iconData.name}
                                variant={formData.icon === iconData.name ? 'default' : 'outline'}
                                size="sm"
                                className="h-10 w-10 p-0"
                                onClick={() => {
                                  setFormData({ ...formData, icon: iconData.name })
                                  setIconPopoverOpen(false)
                                }}
                              >
                                <IconComp className="h-4 w-4" />
                              </Button>
                            )
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid gap-2">
                    <Label>Color</Label>
                    <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: formData.color }}
                          />
                          <span>
                            {PREDEFINED_COLORS.find(c => c.value === formData.color)?.label || 'Select Color'}
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="disabled"
                      checked={formData.disabled}
                      onCheckedChange={(checked) => setFormData({ ...formData, disabled: checked as boolean })}
                    />
                    <Label htmlFor="disabled" className="cursor-pointer">
                      Disabled
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
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
              This will move the cashback group to trash. You can restore it later from the trash view.
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
            <AlertDialogTitle>Restore cashback group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the cashback group and make it active again.
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
