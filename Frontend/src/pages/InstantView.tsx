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
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Plus, Search, RefreshCw, ArrowUpDown, Trash2, Pencil, Download, Settings } from 'lucide-react'
import { instantApi } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import type { Instant, InstantCreateDto } from '../lib/api'
import { toast } from 'sonner'

export default function InstantView() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [open, setOpen] = useState(false)
  const [editingInstant, setEditingInstant] = useState<Instant | null>(null)
  const [formData, setFormData] = useState<InstantCreateDto>({
    title: '',
    name: '',
    location: '',
    description: '',
    comments: '',
    status: 'active',
    color: '#3b82f6',
  })

  // Fetch instants
  const { data: instants = [], isLoading, refetch } = useQuery({
    queryKey: ['instants'],
    queryFn: () => instantApi.getAll({
      search: globalFilter,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? 'desc' : 'asc'
    }),
    enabled: false,
  })

  // Refetch when sorting or filter changes
  useEffect(() => {
    refetch()
  }, [sorting, globalFilter, refetch])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: instantApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instants'] })
      toast.success('Instant created successfully')
      setOpen(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to create instant')
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InstantCreateDto> }) => 
      instantApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instants'] })
      toast.success('Instant updated successfully')
      setOpen(false)
      resetForm()
    },
    onError: () => {
      toast.error('Failed to update instant')
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: instantApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instants'] })
      toast.success('Instant deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete instant')
    },
  })

  const columns: ColumnDef<Instant>[] = [
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
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const instant = row.original
        return (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(`/instant/${instant.id}/settings`)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleEdit(instant)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(instant.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: instants,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: true,
    onSortingChange: setSorting,
    state: {
      sorting,
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
    })
    setEditingInstant(null)
  }

  const handleEdit = (instant: Instant) => {
    setEditingInstant(instant)
    setFormData({
      title: instant.title,
      name: instant.name,
      location: instant.location,
      description: instant.description,
      comments: instant.comments,
      status: instant.status,
      color: instant.color,
    })
    setOpen(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this instant?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingInstant) {
      updateMutation.mutate({ id: editingInstant.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleSearch = () => {
    setGlobalFilter(searchInput)
  }

  const handleRefresh = () => {
    refetch()
    toast.success('Data refreshed')
  }

  const handleExport = async () => {
    try {
      const blob = await instantApi.export()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `instants_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Export completed successfully')
    } catch (error) {
      toast.error('Failed to export data')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instant</h1>
          <p className="text-muted-foreground">Manage your instant entries</p>
        </div>
        <Dialog open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen)
          if (!isOpen) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingInstant ? 'Edit Instant' : 'Add New Instant'}</DialogTitle>
                <DialogDescription>
                  {editingInstant ? 'Update the instant entry details' : 'Fill in the details to create a new instant entry'}
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
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    value={formData.comments}
                    onChange={(e) =>
                      setFormData({ ...formData, comments: e.target.value })
                    }
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
                    <div className="flex gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="w-20"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) =>
                          setFormData({ ...formData, color: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingInstant ? 'Update' : 'Add'} Instant
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search instant entries..."
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
        <Button onClick={handleRefresh} variant="default" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button onClick={handleExport} variant="default" size="icon">
          <Download className="h-4 w-4" />
        </Button>
      </div>

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

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {instants.length} entries
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
