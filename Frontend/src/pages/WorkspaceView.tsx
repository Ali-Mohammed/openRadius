import { useState, useEffect } from 'react'
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
import { Card, CardContent } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Textarea } from '../components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import { 
  Plus, Search, RefreshCw, ArrowUpDown, Trash2, Pencil, Download, Settings, AlertTriangle, RotateCcw, Clock, User, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Building2, Archive
} from 'lucide-react'
import { workspaceApi, usersApi } from '../lib/api'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Workspace, WorkspaceCreateDto } from '../lib/api'
import { toast } from 'sonner'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent, getColorLabel } from '../utils/iconColorHelper'

export default function WorkspaceView() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('active')
  const [rowSelection, setRowSelection] = useState({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkRestoreDialogOpen, setBulkRestoreDialogOpen] = useState(false)
  const [workspaceToDelete, setworkspaceToDelete] = useState<number | null>(null)
  const [workspaceToRestore, setworkspaceToRestore] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [editingworkspace, setEditingworkspace] = useState<Workspace | null>(null)
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)
  const [formData, setFormData] = useState<workspaceCreateDto>({
    title: '',
    name: '',
    location: '',
    description: '',
    comments: '',
    status: 'active',
    color: '#3b82f6',
    icon: 'Building2',
  })

  // Fetch workspaces
  const { data: workspaces = [], isLoading, refetch } = useQuery({
    queryKey: ['workspaces-view', globalFilter, sorting[0]?.id || '', sorting[0]?.desc || false],
    queryFn: () => workspaceApi.getAll({
      search: globalFilter,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
    }),
    staleTime: 30 * 1000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  })

  // Fetch deleted workspaces
  const { data: deletedworkspaces = [], refetch: refetchDeleted } = useQuery({
    queryKey: ['workspaces-deleted'],
    queryFn: () => workspaceApi.getDeleted(),
    staleTime: 30 * 1000, // Cache for 30 seconds
  })

  // Auto-open create dialog when no workspaces exist
  useEffect(() => {
    if (!isLoading && workspaces.length === 0 && deletedworkspaces.length === 0 && !open) {
      setOpen(true)
    }
  }, [workspaces, deletedworkspaces, isLoading, open])

  // Open dialog when navigated with openDialog state
  useEffect(() => {
    if (location.state?.openDialog) {
      setOpen(true)
      // Clear the state to prevent reopening on subsequent visits
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  // Refetch when sorting or filter changes
  useEffect(() => {
    refetch()
  }, [sorting, globalFilter, refetch])

  // Clear row selection when switching tabs
  useEffect(() => {
    setRowSelection({})
  }, [activeTab])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: workspaceApi.create,
    onSuccess: async (newWorkspace) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces-view'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
      
      // If this is the first workspace, set it as default
      if (workspaces.length === 0 && deletedworkspaces.length === 0) {
        try {
          await usersApi.setWorkspace(newWorkspace.id, true)
          toast.success('First workspace created and set as default')
        } catch (error) {
          toast.success('Workspace created successfully')
        }
      } else {
        toast.success('Workspace created successfully')
      }
      
      setOpen(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to create Workspace')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<workspaceCreateDto> }) => 
      workspaceApi.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces-view'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
      toast.success('Workspace updated successfully')
      setOpen(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to update Workspace')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn:async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces-view'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
      toast.success('Workspace deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete Workspace')
    },
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: workspaceApi.restore,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces-view'] })
      await queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
      toast.success('Workspace restored successfully')
    },
    onError: () => {
      toast.error('Failed to restore Workspace')
    },
  })

  const columns: ColumnDef<Workspace>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'title',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="px-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const title = row.getValue('title') as string
        const color = row.original.color
        const iconName = row.original.icon
        const IconComponent = getIconComponent(iconName)
        return (
          <div className="flex items-center gap-2">
            <div 
              className="rounded-lg p-1.5 flex items-center justify-center"
              style={{ 
                backgroundColor: `${color}15`,
                color: color 
              }}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <span>{title}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="px-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: 'location',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="px-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Location
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => {
        const description = row.getValue('description') as string
        return <span className="line-clamp-2">{description}</span>
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            className="px-0 hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <Badge variant={status === 'active' ? 'default' : 'secondary'}>
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'createdBy',
      header: 'Created By',
      cell: ({ row }) => {
        const createdBy = row.getValue('createdBy') as string
        return (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{createdBy}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'))
        return (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const Workspace = row.original
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(`/Workspace/${Workspace.id}/settings`)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleEdit(Workspace)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(Workspace.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  // Columns for deleted items
  const deletedColumns: ColumnDef<Workspace>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const title = row.getValue('title') as string
        const color = row.original.color
        const iconName = row.original.icon
        const IconComponent = getIconComponent(iconName)
        return (
          <div className="flex items-center gap-2">
            <div 
              className="rounded-lg p-1.5 flex items-center justify-center"
              style={{ 
                backgroundColor: `${color}15`,
                color: color 
              }}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <span>{title}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'name',
      header: 'Name',
    },
    {
      accessorKey: 'deletedBy',
      header: 'Deleted By',
      cell: ({ row }) => {
        const deletedBy = row.getValue('deletedBy') as string
        return (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{deletedBy}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'deletedAt',
      header: 'Deleted At',
      cell: ({ row }) => {
        const date = new Date(row.getValue('deletedAt'))
        return (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const Workspace = row.original
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRestore(Workspace.id)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restore
          </Button>
        )
      },
    },
  ]

  const table = useReactTable({
    data: workspaces,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  })

  const deletedTable = useReactTable({
    data: deletedworkspaces,
    columns: deletedColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  })

  const resetForm = () => {
    setFormData({
      title: '',
      name: '',
      location: '',
      description: '',
      comments: '',
      status: 'active',
      color: '#3b82f6',
      icon: 'Building2',
    })
    setEditingworkspace(null)
  }



  const handleEdit = (Workspace: Workspace) => {
    setEditingworkspace(Workspace)
    setFormData({
      title: Workspace.title,
      name: Workspace.name,
      location: Workspace.location,
      description: Workspace.description,
      comments: Workspace.comments,
      status: Workspace.status,
      color: Workspace.color,
      icon: Workspace.icon || 'Building2',
    })
    setOpen(true)
  }

  const handleDelete = (id: number) => {
    setworkspaceToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleRestore = (id: number) => {
    setworkspaceToRestore(id)
    setRestoreDialogOpen(true)
  }

  const confirmDelete = () => {
    if (workspaceToDelete) {
      deleteMutation.mutate(workspaceToDelete)
      setDeleteDialogOpen(false)
      setworkspaceToDelete(null)
    }
  }

  const confirmRestore = () => {
    if (workspaceToRestore) {
      restoreMutation.mutate(workspaceToRestore)
      setRestoreDialogOpen(false)
      setworkspaceToRestore(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingworkspace) {
      updateMutation.mutate({ id: editingworkspace.id, data: formData })
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
    const promises = selectedRows.map(row => workspaceApi.delete(row.original.id))
    
    try {
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
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
    const promises = selectedRows.map(row => workspaceApi.restore(row.original.id))
    
    try {
      await Promise.all(promises)
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
      toast.success(`${selectedRows.length} item(s) restored successfully`)
      setRowSelection({})
      setBulkRestoreDialogOpen(false)
    } catch (error) {
      toast.error('Failed to restore some items')
    }
  }

  const handleExport = async () => {
    const loadingToast = toast.loading('Preparing export...', {
      description: 'Gathering data and generating Excel file'
    })
    
    try {
      const blob = await workspaceApi.export()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workspaces_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export completed successfully', {
        id: loadingToast,
        description: 'Your file has been downloaded'
      })
    } catch (error) {
      toast.error('Failed to export data', {
        id: loadingToast,
        description: 'Please try again'
      })
    }
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">Manage your workspace entries</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">
                <Building2 className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search workspaces..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={handleRefresh} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleExport} variant="outline" size="icon" title="Export data">
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            // Prevent closing if this is the first workspace prompt
            if (!isOpen && workspaces.length === 0 && deletedworkspaces.length === 0 && !editingworkspace) {
              return
            }
            setOpen(isOpen)
            if (!isOpen) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button disabled={activeTab === 'deleted'}>
                <Plus className="mr-2 h-4 w-4" />
                Add Workspace
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingworkspace ? 'Edit Workspace' : workspaces.length === 0 && deletedworkspaces.length === 0 ? 'Create Your First Workspace' : 'Add New Workspace'}
                </DialogTitle>
                <DialogDescription>
                  {workspaces.length === 0 && deletedworkspaces.length === 0 && !editingworkspace
                    ? 'Welcome! Let\'s get started by creating your first workspace. This workspace will be set as your default workspace.'
                    : editingworkspace 
                      ? 'Update the Workspace entry details' 
                      : 'Fill in the details to create a new Workspace entry'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comments">Comments (Optional)</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) =>
                      setFormData({ ...formData, comments: e.target.value })
                    }
                    placeholder="Optional comments..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: 'active' | 'inactive') =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Select
                      value={formData.color}
                      onValueChange={(value) =>
                        setFormData({ ...formData, color: value })
                      }
                    >
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <div className="relative">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      type="button"
                      onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                    >
                      {(() => {
                        const IconComponent = getIconComponent(formData.icon)
                        return <IconComponent className="w-4 h-4 mr-2" />
                      })()}
                      {formData.icon || 'Building2'}
                    </Button>
                    {iconPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border rounded-md shadow-lg z-50">
                        <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                          {AVAILABLE_ICONS.map((iconData) => {
                            const IconComponent = iconData.icon
                            const isSelected = formData.icon === iconData.name
                            return (
                              <button
                                key={iconData.name}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setFormData({ ...formData, icon: iconData.name })
                                  setIconPopoverOpen(false)
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
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                {workspaces.length > 0 || deletedworkspaces.length > 0 || editingworkspace ? (
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" variant="default" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      {editingworkspace ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingworkspace ? 'Update' : workspaces.length === 0 && deletedworkspaces.length === 0 ? 'Create First Workspace' : 'Add'} Workspace
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="active" className="mt-0">
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
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                        <TableHead className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableHead>
                        <TableHead className="sticky right-0 bg-background h-12 px-4"><Skeleton className="h-4 w-16" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                          <TableCell className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableCell>
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
              ) : !isLoading && workspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No workspaces yet</h3>
                  <p className="text-sm text-muted-foreground mb-6">Get started by creating your first workspace</p>
                  <Button onClick={() => setOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Workspace
                  </Button>
                </div>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-muted">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="h-12 px-4">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="border-b">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="h-12 px-4">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              {workspaces.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                      <Select
                        value={table.getState().pagination.pageSize.toString()}
                        onValueChange={(value) => table.setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-sm text-muted-foreground font-medium">
                      Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, workspaces.length)} of {workspaces.length} workspaces
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="mt-0">
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-hidden relative">
              {deletedworkspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full bg-muted p-6 mb-4">
                    <Archive className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No deleted workspaces</h3>
                  <p className="text-sm text-muted-foreground">Deleted workspaces will appear here</p>
                </div>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                      {deletedTable.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-muted">
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} className="h-12 px-4">
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {deletedTable.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} className="border-b">
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="h-12 px-4">
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              {deletedworkspaces.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                      <Select
                        value={deletedTable.getState().pagination.pageSize.toString()}
                        onValueChange={(value) => deletedTable.setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="text-sm text-muted-foreground font-medium">
                      Showing {deletedTable.getState().pagination.pageIndex * deletedTable.getState().pagination.pageSize + 1} to {Math.min((deletedTable.getState().pagination.pageIndex + 1) * deletedTable.getState().pagination.pageSize, deletedworkspaces.length)} of {deletedworkspaces.length} deleted workspaces
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deletedTable.setPageIndex(0)}
                      disabled={!deletedTable.getCanPreviousPage()}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deletedTable.previousPage()}
                      disabled={!deletedTable.getCanPreviousPage()}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deletedTable.nextPage()}
                      disabled={!deletedTable.getCanNextPage()}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deletedTable.setPageIndex(deletedTable.getPageCount() - 1)}
                      disabled={!deletedTable.getCanNextPage()}
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

      {/* Floating Action Bar for Bulk Operations */}
      {activeTab === 'active' && table.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="font-medium">
            {table.getFilteredSelectedRowModel().rows.length} workspace(s) selected
          </span>
          <div className="h-4 w-px bg-primary-foreground/20" />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setRowSelection({})}
          >
            Clear
          </Button>
        </div>
      )}

      {activeTab === 'deleted' && deletedTable.getFilteredSelectedRowModel().rows.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5">
          <span className="font-medium">
            {deletedTable.getFilteredSelectedRowModel().rows.length} workspace(s) selected
          </span>
          <div className="h-4 w-px bg-primary-foreground/20" />
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={handleBulkRestore}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setRowSelection({})}
          >
            Clear
          </Button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl">Delete Workspace Entry</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="pt-3 text-base">
              Are you absolutely sure you want to delete this Workspace entry? This action cannot be undone and will permanently remove the entry from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <RotateCcw className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl">Restore Workspace Entry</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="pt-3 text-base">
              Do you want to restore this Workspace entry? It will be moved back to the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRestore} 
              className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl">Delete Multiple Entries</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="pt-3 text-base">
              Are you sure you want to delete {table.getFilteredSelectedRowModel().rows.length} selected Workspace entries? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkDelete} 
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkRestoreDialogOpen} onOpenChange={setBulkRestoreDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <RotateCcw className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <AlertDialogTitle className="text-xl">Restore Multiple Entries</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="pt-3 text-base">
              Do you want to restore {deletedTable.getFilteredSelectedRowModel().rows.length} selected Workspace entries? 
              They will be moved back to the active list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
            <AlertDialogCancel className="w-full sm:w-auto mt-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBulkRestore} 
              className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

