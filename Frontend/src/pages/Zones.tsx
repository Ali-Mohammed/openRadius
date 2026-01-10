import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Textarea } from '../components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Plus, Search, RefreshCw, ArrowUpDown, Trash2, Pencil, RotateCcw, Users, Radio, MapPin, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { zoneApi, type Zone } from '@/services/zoneApi'
import { userManagementApi, type User } from '@/api/userManagementApi'
import { formatApiError } from '@/utils/errorHandler'
import type { ZoneCreateDto, ZoneUpdateDto } from '@/services/zoneApi'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function Zones() {
  const { t } = useTranslation()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [open, setOpen] = useState(false)
  const [assignUsersDialogOpen, setAssignUsersDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('active')
  const [rowSelection, setRowSelection] = useState({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false)
  const [zoneToDelete, setZoneToDelete] = useState<number | null>(null)
  const [zoneToRestore, setZoneToRestore] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)
  const [formData, setFormData] = useState<ZoneCreateDto>({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: 'MapPin',
  })
  const hasSetInitialUsers = useRef(false)

  const workspaceIdNum = currentWorkspaceId || 0

  // Fetch zones
  const { data: zones = [], isLoading, refetch } = useQuery({
    queryKey: ['zones', workspaceIdNum, globalFilter, sorting[0]?.id || '', sorting[0]?.desc || false],
    queryFn: () => zoneApi.getZones(workspaceIdNum),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
    enabled: !!workspaceIdNum,
  })

  // Fetch deleted zones
  const { data: deletedZones = [], refetch: refetchDeleted } = useQuery({
    queryKey: ['zones-deleted', workspaceIdNum],
    queryFn: () => zoneApi.getDeletedZones(workspaceIdNum),
    staleTime: 30 * 1000,
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

  // Reset selected users when dialog closes
  useEffect(() => {
    if (!assignUsersDialogOpen) {
      setSelectedUserIds([])
      hasSetInitialUsers.current = false
    }
  }, [assignUsersDialogOpen])

  // Set selected users when zone users are loaded
  useEffect(() => {
    if (assignUsersDialogOpen && zoneUserIds.length > 0 && !hasSetInitialUsers.current) {
      setSelectedUserIds(zoneUserIds)
      hasSetInitialUsers.current = true
    }
  }, [zoneUserIds, assignUsersDialogOpen])

  // Clear row selection when switching tabs
  useEffect(() => {
    setRowSelection({})
  }, [activeTab])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: zoneApi.createZone.bind(null, workspaceIdNum),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      toast.success('Zone created successfully')
      setOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ZoneUpdateDto> }) => 
      zoneApi.updateZone(workspaceIdNum, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      toast.success('Zone updated successfully')
      setOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => zoneApi.deleteZone(workspaceIdNum, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['zones-deleted'] })
      toast.success('Zone deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (id: number) => zoneApi.restoreZone(workspaceIdNum, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['zones-deleted'] })
      toast.success('Zone restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error))
    },
  })

  // Assign users mutation
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

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#3b82f6', icon: 'MapPin' })
    setEditingZone(null)
    setIconPopoverOpen(false)
  }

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone)
    setFormData({
      name: zone.name,
      description: zone.description,
      color: zone.color || '#3b82f6',
      icon: zone.icon || 'MapPin',
    })
    setOpen(true)
  }

  const handleDelete = (id: number) => {
    setZoneToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleRestore = (id: number) => {
    setZoneToRestore(id)
    setRestoreDialogOpen(true)
  }

  const handleAssignUsers = (zone: Zone) => {
    setSelectedZone(zone)
    setUserSearchQuery('')
    setAssignUsersDialogOpen(true)
  }

  const confirmDelete = () => {
    if (zoneToDelete) {
      deleteMutation.mutate(zoneToDelete)
      setDeleteDialogOpen(false)
      setZoneToDelete(null)
    }
  }

  const confirmRestore = () => {
    if (zoneToRestore) {
      restoreMutation.mutate(zoneToRestore)
      setRestoreDialogOpen(false)
      setZoneToRestore(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleSearch = () => {
    setGlobalFilter(searchInput)
  }

  const handleRefresh = () => {
    refetch()
    refetchDeleted()
    toast.success('Data refreshed')
  }

  const handleBulkDelete = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) {
      toast.error('No items selected')
      return
    }
    setBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const promises = selectedRows.map(row => zoneApi.deleteZone(workspaceIdNum, row.original.id))
    
    try {
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['zones-deleted'] })
      toast.success(`${selectedRows.length} item(s) deleted successfully`)
      setRowSelection({})
      setBulkDeleteDialogOpen(false)
    } catch (error) {
      toast.error('Failed to delete some items')
    }
  }

  const handleBulkRestore = () => {
    const selectedRows = deletedTable.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) {
      toast.error('No items selected')
      return
    }
    setBulkRestoreDialogOpen(true)
  }

  const confirmBulkRestore = async () => {
    const selectedRows = deletedTable.getFilteredSelectedRowModel().rows
    const promises = selectedRows.map(row => zoneApi.restoreZone(workspaceIdNum, row.original.id))
    
    try {
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['zones'] })
      queryClient.invalidateQueries({ queryKey: ['zones-deleted'] })
      toast.success(`${selectedRows.length} item(s) restored successfully`)
      setRowSelection({})
      setBulkRestoreDialogOpen(false)
    } catch (error) {
      toast.error('Failed to restore some items')
    }
  }

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const filteredUsers = allUsers.filter(user =>
    !userSearchQuery || user.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  // Columns for active zones
  const columns: ColumnDef<Zone>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant='ghost'
            className='px-0 hover:bg-transparent'
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            <ArrowUpDown className='ml-2 h-4 w-4' />
          </Button>
        )
      },
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        const color = row.original.color || '#3b82f6'
        const icon = row.original.icon || 'MapPin'
        const IconComponent = getIconComponent(icon)
        return (
          <div className='flex items-center gap-2'>
            <div 
              className='rounded-lg p-1.5 flex items-center justify-center'
              style={{ 
                backgroundColor: `${color}15`,
                color: color 
              }}
            >
              <IconComponent className='h-4 w-4' />
            </div>
            <span>{name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        return <span className='line-clamp-2'>{description || '-'}</span>
      },
    },
    {
      accessorKey: 'userCount',
      header: 'Users',
      cell: ({ row }) => (
        <div className='flex items-center gap-1'>
          <Users className='h-3 w-3 text-muted-foreground' />
          <span className='text-sm'>{row.original.userCount}</span>
        </div>
      ),
    },
    {
      accessorKey: 'radiusUserCount',
      header: 'Radius Users',
      cell: ({ row }) => (
        <div className='flex items-center gap-1'>
          <Radio className='h-3 w-3 text-muted-foreground' />
          <span className='text-sm'>{row.original.radiusUserCount}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const zone = row.original
        return (
          <div className='flex gap-2'>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => handleAssignUsers(zone)}
              title='Assign users'
            >
              <UserPlus className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => handleEdit(zone)}
            >
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => handleDelete(zone.id)}
            >
              <Trash2 className='h-4 w-4 text-destructive' />
            </Button>
          </div>
        )
      },
    },
  ], [])

  // Columns for deleted zones
  const deletedColumns: ColumnDef<Zone>[] = useMemo(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const name = row.getValue('name') as string
        const color = row.original.color || '#3b82f6'
        const icon = row.original.icon || 'MapPin'
        const IconComponent = getIconComponent(icon)
        return (
          <div className='flex items-center gap-2'>
            <div 
              className='rounded-lg p-1.5 flex items-center justify-center'
              style={{ 
                backgroundColor: `${color}15`,
                color: color 
              }}
            >
              <IconComponent className='h-4 w-4' />
            </div>
            <span>{name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
    },
    {
      accessorKey: 'deletedAt',
      header: 'Deleted At',
      cell: ({ row }) => {
        const date = row.original.deletedAt ? new Date(row.original.deletedAt) : null
        return date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : '-'
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const zone = row.original
        return (
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={() => handleRestore(zone.id)}
          >
            <RotateCcw className='h-4 w-4 text-green-600' />
          </Button>
        )
      },
    },
  ], [])

  const table = useReactTable({
    data: zones,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  })

  const deletedTable = useReactTable({
    data: deletedZones,
    columns: deletedColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  })

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Zones</h1>
          <p className='text-muted-foreground'>Manage billing zones</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setOpen(true) }}>
              <Plus className='mr-2 h-4 w-4' />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent className='max-w-2xl'>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingZone ? 'Edit Zone' : 'Add New Zone'}</DialogTitle>
                <DialogDescription>
                  {editingZone ? 'Update the zone details' : 'Fill in the details to create a new Zone entry'}
                </DialogDescription>
              </DialogHeader>
              <div className='grid gap-4 py-4'>
                <div className='space-y-2'>
                  <Label htmlFor='name'>Name *</Label>
                  <Input
                    id='name'
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='description'>Description</Label>
                  <Textarea
                    id='description'
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='color'>Color</Label>
                    <Select
                      value={formData.color}
                      onValueChange={(value) => setFormData({ ...formData, color: value })}
                    >
                      <SelectTrigger>
                        <div className='flex items-center gap-2'>
                          <div
                            className='w-4 h-4 rounded-full border'
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
                            <div className='flex items-center gap-2'>
                              <div
                                className='w-4 h-4 rounded-full border'
                                style={{ backgroundColor: color.value }}
                              />
                              {color.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='icon'>Icon</Label>
                    <div className='relative'>
                      <Button
                        variant='outline'
                        className='w-full justify-start'
                        type='button'
                        onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                      >
                        {(() => {
                          const IconComponent = getIconComponent(formData.icon || 'MapPin')
                          return <IconComponent className='w-4 h-4 mr-2' />
                        })()}
                        {formData.icon || 'MapPin'}
                      </Button>
                      {iconPopoverOpen && (
                        <div className='absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50'>
                          <div className='grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto'>
                            {AVAILABLE_ICONS.map((iconData) => {
                              const IconComponent = iconData.icon
                              const isSelected = formData.icon === iconData.name
                              return (
                                <button
                                  key={iconData.name}
                                  type='button'
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setFormData({ ...formData, icon: iconData.name })
                                    setIconPopoverOpen(false)
                                  }}
                                  className={`p-2 rounded flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  }`}
                                  style={{
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  title={iconData.name}
                                >
                                  <IconComponent className='w-4 h-4' />
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type='button' variant='outline' onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type='submit' disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingZone ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className='flex items-center justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value='active'>
                Active ({zones.length})
              </TabsTrigger>
              <TabsTrigger value='deleted'>
                <Trash2 className='mr-2 h-4 w-4' />
                Deleted ({deletedZones.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className='flex flex-1 items-center gap-2'>
            <div className='relative max-w-sm'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search zones...'
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className='pl-9'
              />
            </div>
            <Button onClick={handleSearch} variant='secondary'>
              Search
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {activeTab === 'active' && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button onClick={handleBulkDelete} variant='destructive' size='sm'>
              <Trash2 className='mr-2 h-4 w-4' />
              Delete ({table.getFilteredSelectedRowModel().rows.length})
            </Button>
          )}
          {activeTab === 'deleted' && deletedTable.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button onClick={handleBulkRestore} variant='default' size='sm' className='bg-green-600 hover:bg-green-700'>
              <RotateCcw className='mr-2 h-4 w-4' />
              Restore ({deletedTable.getFilteredSelectedRowModel().rows.length})
            </Button>
          )}
          <Button onClick={handleRefresh} variant='default' size='icon'>
            <RefreshCw className='h-4 w-4' />
          </Button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center'>
                    Loading...
                  </TableCell>
                </TableRow>
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center'>
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              {deletedTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {deletedTable.getRowModel().rows?.length ? (
                deletedTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={deletedColumns.length} className='h-24 text-center'>
                    No deleted zones.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Assign Users Dialog */}
      <Dialog open={assignUsersDialogOpen} onOpenChange={setAssignUsersDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Assign Users to Zone</DialogTitle>
            <DialogDescription>
              Select multiple users to assign to <strong>{selectedZone?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (selectedZone) {
              assignUsersMutation.mutate({ zoneId: selectedZone.id, userIds: selectedUserIds })
            }
          }}>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label>Search Users</Label>
                <div className='relative'>
                  <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Search by name or email...'
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className='pl-8'
                  />
                </div>
              </div>
              <div className='border rounded-md h-[400px] overflow-y-auto'>
                <div className='p-2 space-y-1'>
                  {filteredUsers.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                      No users found
                    </div>
                  ) : (
                    filteredUsers.map((user) => (
                      <div
                        key={user.keycloakUserId || user.id}
                        className='flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer'
                        onClick={() => handleToggleUser(user.keycloakUserId || user.id.toString())}
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(user.keycloakUserId || user.id.toString())}
                          onCheckedChange={() => handleToggleUser(user.keycloakUserId || user.id.toString())}
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='font-medium truncate'>
                            {user.firstName} {user.lastName}
                          </div>
                          <div className='text-sm text-muted-foreground truncate'>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className='flex items-center justify-between text-sm text-muted-foreground'>
                <span>{selectedUserIds.length} user(s) selected</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => setSelectedUserIds([])}
                  disabled={selectedUserIds.length === 0}
                >
                  Clear selection
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setAssignUsersDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit' disabled={assignUsersMutation.isPending}>
                {assignUsersMutation.isPending ? 'Assigning...' : 'Assign Users'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action will remove zone assignments from radius users.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className='bg-destructive hover:bg-destructive/90'>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Zone</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this zone?
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Zones</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {table.getFilteredSelectedRowModel().rows.length} zone(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className='bg-destructive hover:bg-destructive/90'>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Restore Confirmation */}
      <AlertDialog open={bulkRestoreDialogOpen} onOpenChange={setBulkRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Selected Zones</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore {deletedTable.getFilteredSelectedRowModel().rows.length} zone(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRestore}>
              Restore All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
