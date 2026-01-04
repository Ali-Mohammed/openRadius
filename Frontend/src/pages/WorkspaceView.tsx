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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs'
import { 
  Plus, Search, RefreshCw, ArrowUpDown, Trash2, Pencil, Download, Settings, AlertTriangle, RotateCcw, Clock, User, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Tag as TagIcon, Star, Heart, Zap, Trophy, Crown, Shield, 
  Users, Building, Briefcase, Rocket, Target, Award, Medal, Flag, 
  CheckCircle, XCircle, AlertCircle, Info, Home, Mail, Phone,
  Calendar, DollarSign, CreditCard, ShoppingCart, Package, Truck,
  MapPin, Globe, Wifi, Database, Server, Cloud, Lock, Key, Eye, Bell,
  MessageCircle, Send, Bookmark, Archive, FileText, Folder, Upload,
  Share, Link, Layers, Grid, List, Filter, Circle,
  Square, Triangle, Diamond, Hexagon, Octagon, Sparkles, Coffee, Music,
  Camera, Image, Video, Mic, Headphones, Speaker, Monitor, Smartphone, Tablet,
  Watch, Printer, Cpu, HardDrive, Battery, Bluetooth, Radio, Rss,
  Building2
} from 'lucide-react'
import { workspaceApi, usersApi } from '../lib/api'
import { useNavigate, useLocation } from 'react-router-dom'
import type { Workspace, WorkspaceCreateDto } from '../lib/api'
import { toast } from 'sonner'

const PREDEFINED_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
]

const AVAILABLE_ICONS = [
  { name: 'Building2', icon: Building2 },
  { name: 'Tag', icon: TagIcon },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Crown', icon: Crown },
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
  { name: 'Info', icon: Info },
  { name: 'Settings', icon: Settings },
  { name: 'Home', icon: Home },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Calendar', icon: Calendar },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Package', icon: Package },
  { name: 'Truck', icon: Truck },
  { name: 'MapPin', icon: MapPin },
  { name: 'Globe', icon: Globe },
  { name: 'Wifi', icon: Wifi },
  { name: 'Database', icon: Database },
  { name: 'Server', icon: Server },
  { name: 'Cloud', icon: Cloud },
  { name: 'Lock', icon: Lock },
  { name: 'Key', icon: Key },
  { name: 'Eye', icon: Eye },
  { name: 'Bell', icon: Bell },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Send', icon: Send },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'Archive', icon: Archive },
  { name: 'FileText', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'Share', icon: Share },
  { name: 'Link', icon: Link },
  { name: 'Layers', icon: Layers },
  { name: 'Grid', icon: Grid },
  { name: 'List', icon: List },
  { name: 'Filter', icon: Filter },
  { name: 'Search', icon: Search },
  { name: 'Circle', icon: Circle },
  { name: 'Square', icon: Square },
  { name: 'Triangle', icon: Triangle },
  { name: 'Diamond', icon: Diamond },
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Octagon', icon: Octagon },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Mic', icon: Mic },
  { name: 'Headphones', icon: Headphones },
  { name: 'Speaker', icon: Speaker },
  { name: 'Monitor', icon: Monitor },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Tablet', icon: Tablet },
  { name: 'Watch', icon: Watch },
  { name: 'Printer', icon: Printer },
  { name: 'Cpu', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Battery', icon: Battery },
  { name: 'Bluetooth', icon: Bluetooth },
  { name: 'Radio', icon: Radio },
  { name: 'Rss', icon: Rss },
]

export default function workspaceView() {
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
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getAll({
      search: globalFilter,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
    }),
  })

  // Fetch deleted workspaces
  const { data: deletedworkspaces = [], refetch: refetchDeleted } = useQuery({
    queryKey: ['workspaces-deleted'],
    queryFn: () => workspaceApi.getDeleted(),
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
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
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
    mutationFn: workspaceApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      queryClient.invalidateQueries({ queryKey: ['workspaces-deleted'] })
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
      accessorKey: 'color',
      header: 'Color',
      cell: ({ row }) => {
        const color = row.getValue('color') as string
        return (
          <div className="flex items-center gap-2">
            <div
              className="h-6 w-6 rounded border"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-muted-foreground">{color}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'icon',
      header: 'Icon',
      cell: ({ row }) => {
        const iconName = row.getValue('icon') as string
        const IconComponent = getIconComponent(iconName)
        const color = row.original.color
        return (
          <div className="flex items-center gap-2">
            <div 
              className="rounded-lg p-2 flex items-center justify-center"
              style={{ 
                backgroundColor: `${color}15`,
                color: color 
              }}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <span className="text-sm text-muted-foreground">{iconName || 'Building2'}</span>
          </div>
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

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return Building2
    const iconData = AVAILABLE_ICONS.find(i => i.name === iconName)
    return iconData?.icon || Building2
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspace</h1>
          <p className="text-muted-foreground">Manage your Workspace entries</p>
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
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New
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

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">
                Active ({workspaces.length})
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Trash2 className="mr-2 h-4 w-4" />
                Deleted ({deletedworkspaces.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-1 items-center gap-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search Workspace entries..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} variant="secondary">
              Search
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'active' && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button onClick={handleBulkDelete} variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({table.getFilteredSelectedRowModel().rows.length})
            </Button>
          )}
          {activeTab === 'deleted' && deletedTable.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button onClick={handleBulkRestore} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore ({deletedTable.getFilteredSelectedRowModel().rows.length})
            </Button>
          )}
          <Button onClick={handleRefresh} variant="default" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport} variant="default" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeTab === 'active' ? (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()} ({workspaces.length} total entries)
          </p>
          <Select
            value={table.getState().pagination.pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="w-[110px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {deletedTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
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
                {deletedworkspaces.length ? (
                  deletedTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={deletedColumns.length}
                      className="h-24 text-center"
                    >
                      No deleted items.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Page {deletedTable.getState().pagination.pageIndex + 1} of{' '}
                {deletedTable.getPageCount()} ({deletedworkspaces.length} total entries)
              </p>
              <Select
                value={deletedTable.getState().pagination.pageSize.toString()}
                onValueChange={(value) => deletedTable.setPageSize(Number(value))}
              >
                <SelectTrigger className="w-[110px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => deletedTable.setPageIndex(0)}
                disabled={!deletedTable.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deletedTable.previousPage()}
                disabled={!deletedTable.getCanPreviousPage()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deletedTable.nextPage()}
                disabled={!deletedTable.getCanNextPage()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => deletedTable.setPageIndex(deletedTable.getPageCount() - 1)}
                disabled={!deletedTable.getCanNextPage()}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
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

