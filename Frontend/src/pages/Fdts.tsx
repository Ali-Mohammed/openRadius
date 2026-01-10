import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { fdtApi, type Fdt } from '@/services/fdtApi'
import { oltApi, type PonPortList } from '@/services/oltApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatDate } from '@/utils/formatNumber'

export default function Fdts() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentWorkspaceId } = useWorkspace()

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

  // FDT state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFdt, setEditingFdt] = useState<Fdt | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fdtToDelete, setFdtToDelete] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [fdtToRestore, setFdtToRestore] = useState<string | null>(null)
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    code: true,
    name: true,
    ponPort: true,
    olt: true,
    cabinet: true,
    capacity: true,
    usedPorts: true,
    splitRatio: true,
    status: true,
    zone: true,
    fatCount: true,
    createdAt: false,
  })

  const [showTrash, setShowTrash] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    ponPortId: '',
    cabinet: 'indoor',
    capacity: '',
    splitRatio: '',
    installationDate: '',
    status: 'active',
    address: '',
    zone: '',
    latitude: '',
    longitude: '',
    notes: '',
  })

  // Queries
  const { data: fdtsData, isLoading, isFetching } = useQuery({
    queryKey: ['fdts', currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash 
      ? fdtApi.getTrash(currentPage, pageSize)
      : fdtApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
  })

  // Fetch PON ports for dropdown
  const { data: ponPorts = [] } = useQuery({
    queryKey: ['ponPorts'],
    queryFn: () => oltApi.getPonPorts(),
  })

  const fdts = useMemo(() => fdtsData?.data || [], [fdtsData?.data])
  const pagination = fdtsData?.pagination

  // Virtual scrolling - optimized for large datasets
  const rowVirtualizer = useVirtualizer({
    count: fdts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => fdtApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fdts'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create FDT')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fdtApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fdts'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update FDT')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fdtApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fdts'] })
      toast.success('FDT deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete FDT')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => fdtApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fdts'] })
      toast.success('FDT restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore FDT')
    },
  })

  // Handlers
  const handleOpenDialog = (fdt?: Fdt) => {
    if (fdt) {
      setEditingFdt(fdt)
      setFormData({
        code: fdt.code || '',
        name: fdt.name || '',
        ponPortId: fdt.ponPortId || '',
        cabinet: fdt.cabinet || 'indoor',
        capacity: fdt.capacity?.toString() || '',
        splitRatio: fdt.splitRatio || '',
        installationDate: fdt.installationDate ? fdt.installationDate.split('T')[0] : '',
        status: fdt.status || 'active',
        address: fdt.address || '',
        zone: fdt.zone || '',
        latitude: fdt.latitude?.toString() || '',
        longitude: fdt.longitude?.toString() || '',
        notes: '',
      })
    } else {
      setEditingFdt(null)
      setFormData({
        code: '',
        name: '',
        ponPortId: '',
        cabinet: 'indoor',
        capacity: '',
        splitRatio: '',
        installationDate: '',
        status: 'active',
        address: '',
        zone: '',
        latitude: '',
        longitude: '',
        notes: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingFdt(null)
  }

  const handleSave = async () => {
    if (!formData.code || !formData.ponPortId || !formData.capacity) {
      toast.error('Code, PON Port ID, and Capacity are required')
      return
    }

    const data = {
      code: formData.code,
      name: formData.name || undefined,
      ponPortId: formData.ponPortId,
      cabinet: formData.cabinet || undefined,
      capacity: parseInt(formData.capacity),
      splitRatio: formData.splitRatio || undefined,
      installationDate: formData.installationDate || undefined,
      status: formData.status,
      address: formData.address || undefined,
      zone: formData.zone || undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
      notes: formData.notes || undefined,
    }

    try {
      if (editingFdt && editingFdt.id) {
        await updateMutation.mutateAsync({ id: editingFdt.id, data })
        toast.success('FDT updated successfully')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('FDT created successfully')
      }
      handleCloseDialog()
    } catch (error) {
      // Error already handled by mutations
    }
  }

  const handleDelete = (id?: string) => {
    if (id) {
      setFdtToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (fdtToDelete) {
      deleteMutation.mutate(fdtToDelete)
      setDeleteDialogOpen(false)
      setFdtToDelete(null)
    }
  }

  const handleRestore = (fdtId: string) => {
    setFdtToRestore(fdtId)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (fdtToRestore) {
      restoreMutation.mutate(fdtToRestore)
      setRestoreDialogOpen(false)
      setFdtToRestore(null)
    }
  }

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

  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      pages.push(total)
    }
    
    return pages
  }, [])

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const blob = await fdtApi.exportToCsv(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fdts_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('CSV exported successfully')
    } catch (error) {
      toast.error('Failed to export CSV')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    try {
      const blob = await fdtApi.exportToExcel(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fdts_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel exported successfully')
    } catch (error) {
      toast.error('Failed to export Excel')
    } finally {
      setIsExporting(false)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'maintenance':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      {isExporting && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Exporting data...</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FDTs</h1>
          <p className="text-muted-foreground">Manage Fiber Distribution Terminals</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowTrash(!showTrash)}
            variant={showTrash ? 'default' : 'outline'}
          >
            <Archive className="mr-2 h-4 w-4" />
            {showTrash ? 'Show Active' : 'Show Trash'}
          </Button>
          {!showTrash && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Add FDT
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Search FDTs..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="max-w-sm"
                />
                <Button onClick={handleSearch} variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['fdts', currentWorkspaceId] })} 
                  variant="outline" 
                  size="icon"
                  title={t('common.refresh')}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon"
                      disabled={isExporting}
                      title="Export data"
                    >
                      {isExporting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={handleExportCsv}
                        disabled={isExporting}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export as CSV
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={handleExportExcel}
                        disabled={isExporting}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export as Excel
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" title="Toggle columns">
                      <Columns3 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 max-h-[500px] overflow-y-auto">
                    <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={Object.values(columnVisibility).every(v => v)}
                      onCheckedChange={(checked) => {
                        setColumnVisibility({
                          code: checked,
                          name: checked,
                          ponPort: checked,
                          olt: checked,
                          cabinet: checked,
                          capacity: checked,
                          usedPorts: checked,
                          splitRatio: checked,
                          status: checked,
                          zone: checked,
                          fatCount: checked,
                          createdAt: checked,
                        })
                      }}
                      onSelect={(e) => e.preventDefault()}
                      className="font-semibold"
                    >
                      {Object.values(columnVisibility).every(v => v) ? 'Hide All' : 'Show All'}
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.code}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, code: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Code
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.name}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.ponPort}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, ponPort: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      PON Port
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.olt}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, olt: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      OLT
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.cabinet}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, cabinet: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Cabinet
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.capacity}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, capacity: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Capacity
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.usedPorts}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, usedPorts: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Used Ports
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.splitRatio}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, splitRatio: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Split Ratio
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.status}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.zone}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, zone: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Zone
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.fatCount}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, fatCount: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      FAT Count
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.createdAt}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, createdAt: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Created At
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Per Page</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="1000">1000</SelectItem>
                    <SelectItem value="999999">All</SelectItem>
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
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-24" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="sticky right-0 bg-background h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="sticky right-0 bg-background h-12 px-4 w-[120px]">
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
          ) : fdts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No FDTs found
            </div>
          ) : (
            <div ref={parentRef} className="overflow-auto" style={{ height: 'calc(100vh - 340px)' }}>
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
                      {columnVisibility.code && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('code')}>Code{getSortIcon('code')}</TableHead>}
                      {columnVisibility.name && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[150px] cursor-pointer select-none" onClick={() => handleSort('name')}>Name{getSortIcon('name')}</TableHead>}
                      {columnVisibility.ponPort && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px]">PON Port</TableHead>}
                      {columnVisibility.olt && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px]">OLT</TableHead>}
                      {columnVisibility.cabinet && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px]">Cabinet</TableHead>}
                      {columnVisibility.capacity && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('capacity')}>Capacity{getSortIcon('capacity')}</TableHead>}
                      {columnVisibility.usedPorts && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px]">Used Ports</TableHead>}
                      {columnVisibility.splitRatio && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[100px]">Split Ratio</TableHead>}
                      {columnVisibility.status && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('status')}>Status{getSortIcon('status')}</TableHead>}
                      {columnVisibility.zone && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('zone')}>Zone{getSortIcon('zone')}</TableHead>}
                      {columnVisibility.fatCount && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px]">FAT Count</TableHead>}
                      {columnVisibility.createdAt && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('createdAt')}>Created At{getSortIcon('createdAt')}</TableHead>}
                      <TableHead className="sticky right-0 bg-muted shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                
                <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const fdt = fdts[virtualRow.index]
                        return (
                          <TableRow 
                            key={fdt.id}
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
                          {columnVisibility.code && <TableCell className="h-12 px-4 font-medium whitespace-nowrap w-[120px]">{fdt.code}</TableCell>}
                          {columnVisibility.name && <TableCell className="h-12 px-4 w-[150px]">{fdt.name || '-'}</TableCell>}
                          {columnVisibility.ponPort && <TableCell className="h-12 px-4 w-[100px]">{fdt.ponPortSlot}/{fdt.ponPortPort}</TableCell>}
                          {columnVisibility.olt && <TableCell className="h-12 px-4 w-[140px]">{fdt.oltName || '-'}</TableCell>}
                          {columnVisibility.cabinet && <TableCell className="h-12 px-4 w-[100px]">{fdt.cabinet || '-'}</TableCell>}
                          {columnVisibility.capacity && <TableCell className="h-12 px-4 text-right w-[100px]">{fdt.capacity || '0'}</TableCell>}
                          {columnVisibility.usedPorts && <TableCell className="h-12 px-4 text-right w-[100px]">{fdt.usedPorts || '0'}</TableCell>}
                          {columnVisibility.splitRatio && <TableCell className="h-12 px-4 w-[100px]">{fdt.splitRatio || '-'}</TableCell>}
                          {columnVisibility.status && <TableCell className="h-12 px-4 w-[120px]">
                            <Badge variant={getStatusBadgeVariant(fdt.status || 'inactive')}>
                              {fdt.status || 'inactive'}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.zone && <TableCell className="h-12 px-4 w-[120px]">{fdt.zone || '-'}</TableCell>}
                          {columnVisibility.fatCount && <TableCell className="h-12 px-4 text-right w-[100px]">{fdt.fatCount || '0'}</TableCell>}
                          {columnVisibility.createdAt && <TableCell className="h-12 px-4 w-[120px]">{formatDate(fdt.createdAt)}</TableCell>}
                          <TableCell className="sticky right-0 bg-card shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 text-right w-[120px]">
                            <div className="flex justify-end gap-2">
                              {showTrash ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(fdt.id!)}
                                  disabled={restoreMutation.isPending}
                                  title="Restore FDT"
                                >
                                  <RotateCcw className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(fdt)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(fdt.id)}
                                    disabled={deleteMutation.isPending}
                                  >
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
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <div className="text-sm text-muted-foreground">
                Showing {formatNumber(fdts.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + fdts.length)} of {formatNumber(pagination.totalRecords)} FDTs
              </div>
              <div className="flex items-center gap-1">
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {getPaginationPages(currentPage, pagination.totalPages).map((page, idx) => (
                  page === '...' ? (
                    <Button
                      key={`ellipsis-${idx}`}
                      variant="ghost"
                      size="sm"
                      disabled
                      className="w-9 p-0"
                    >
                      ...
                    </Button>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page as number)}
                      className="w-9 p-0"
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
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFdt ? 'Edit FDT' : 'Add FDT'}</DialogTitle>
            <DialogDescription>
              {editingFdt ? 'Update FDT details' : 'Fill in the details to create a new FDT'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., FDT-001"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Main Street FDT"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ponPortId">PON Port *</Label>
                <Select
                  value={formData.ponPortId}
                  onValueChange={(value) => setFormData({ ...formData, ponPortId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PON Port" />
                  </SelectTrigger>
                  <SelectContent>
                    {ponPorts.map((port) => (
                      <SelectItem key={port.id} value={port.id}>
                        {port.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cabinet">Cabinet</Label>
                <Select value={formData.cabinet} onValueChange={(value) => setFormData({ ...formData, cabinet: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indoor">Indoor</SelectItem>
                    <SelectItem value="outdoor">Outdoor</SelectItem>
                    <SelectItem value="pole">Pole</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacity *</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="e.g., 16"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="splitRatio">Split Ratio</Label>
                <Input
                  id="splitRatio"
                  value={formData.splitRatio}
                  onChange={(e) => setFormData({ ...formData, splitRatio: e.target.value })}
                  placeholder="e.g., 1:8, 1:16"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="installationDate">Installation Date</Label>
                <Input
                  id="installationDate"
                  type="date"
                  value={formData.installationDate}
                  onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g., 123 Main Street"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="zone">Zone</Label>
              <Input
                id="zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="e.g., North, Central, South"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="e.g., 33.3152"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="e.g., 44.3661"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.code || !formData.ponPortId || !formData.capacity || createMutation.isPending || updateMutation.isPending}
            >
              {editingFdt ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the FDT to trash. You can restore it later from the trash view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore FDT?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the FDT and make it available again.
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
    </div>
  )
}
