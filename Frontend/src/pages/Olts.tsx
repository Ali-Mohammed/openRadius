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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, Columns3, ArrowUpDown, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText, Antenna } from 'lucide-react'
import { oltApi, type Olt } from '@/services/oltApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export default function Olts() {
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
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  // OLT state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOlt, setEditingOlt] = useState<Olt | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [oltToDelete, setOltToDelete] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [oltToRestore, setOltToRestore] = useState<string | null>(null)
  
  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    vendor: true,
    model: true,
    serialNumber: false,
    managementIp: true,
    hostname: false,
    status: true,
    environment: true,
    siteName: true,
    ponPortCount: true,
    createdAt: false,
  })

  const [showTrash, setShowTrash] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    hostname: '',
    vendor: '',
    model: '',
    serialNumber: '',
    managementIp: '',
    managementVlan: '',
    siteName: '',
    environment: 'prod',
    status: 'active',
    assetTag: '',
    role: '',
    loopbackIp: '',
    mgmtInterface: '',
    sshEnabled: true,
    sshPort: '22',
    sshUsername: '',
    snmpVersion: 'v2c',
    snmpPort: '161',
    rack: '',
    rackUnit: '',
    latitude: '',
    longitude: '',
  })

  // Queries
  const { data: oltsData, isLoading, isFetching } = useQuery({
    queryKey: ['olts', currentPage, pageSize, searchQuery, showTrash, sortField, sortDirection],
    queryFn: () => showTrash 
      ? oltApi.getTrash(currentPage, pageSize)
      : oltApi.getAll(currentPage, pageSize, searchQuery, sortField, sortDirection),
  })

  const olts = useMemo(() => oltsData?.data || [], [oltsData?.data])
  const pagination = oltsData?.pagination

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: olts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 2,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => oltApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olts'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create OLT')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      oltApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olts'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update OLT')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => oltApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olts'] })
      toast.success('OLT deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete OLT')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => oltApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['olts'] })
      toast.success('OLT restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore OLT')
    },
  })

  // Handlers
  const handleOpenDialog = (olt?: Olt) => {
    if (olt) {
      setEditingOlt(olt)
      setFormData({
        name: olt.name,
        hostname: olt.hostname || '',
        vendor: olt.vendor,
        model: olt.model,
        serialNumber: olt.serialNumber || '',
        managementIp: olt.managementIp,
        managementVlan: olt.managementVlan?.toString() || '',
        siteName: olt.siteName || '',
        environment: olt.environment || 'prod',
        status: olt.status || 'active',
        assetTag: '',
        role: '',
        loopbackIp: '',
        mgmtInterface: '',
        sshEnabled: true,
        sshPort: '22',
        sshUsername: '',
        snmpVersion: 'v2c',
        snmpPort: '161',
        rack: '',
        rackUnit: '',
        latitude: '',
        longitude: '',
      })
    } else {
      setEditingOlt(null)
      setFormData({
        name: '',
        hostname: '',
        vendor: '',
        model: '',
        serialNumber: '',
        managementIp: '',
        managementVlan: '',
        siteName: '',
        environment: 'prod',
        status: 'active',
        assetTag: '',
        role: '',
        loopbackIp: '',
        mgmtInterface: '',
        sshEnabled: true,
        sshPort: '22',
        sshUsername: '',
        snmpVersion: 'v2c',
        snmpPort: '161',
        rack: '',
        rackUnit: '',
        latitude: '',
        longitude: '',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingOlt(null)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.vendor || !formData.model || !formData.managementIp) {
      toast.error('Name, Vendor, Model, and Management IP are required')
      return
    }

    const data = {
      name: formData.name,
      hostname: formData.hostname || undefined,
      vendor: formData.vendor,
      model: formData.model,
      serialNumber: formData.serialNumber || undefined,
      managementIp: formData.managementIp,
      managementVlan: formData.managementVlan ? parseInt(formData.managementVlan) : undefined,
      siteName: formData.siteName || undefined,
      environment: formData.environment,
      status: formData.status,
      assetTag: formData.assetTag || undefined,
      role: formData.role || undefined,
      loopbackIp: formData.loopbackIp || undefined,
      mgmtInterface: formData.mgmtInterface || undefined,
      sshEnabled: formData.sshEnabled,
      sshPort: parseInt(formData.sshPort) || 22,
      sshUsername: formData.sshUsername || undefined,
      snmpVersion: formData.snmpVersion || undefined,
      snmpPort: parseInt(formData.snmpPort) || 161,
      rack: formData.rack || undefined,
      rackUnit: formData.rackUnit ? parseInt(formData.rackUnit) : undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
    }

    try {
      if (editingOlt && editingOlt.id) {
        await updateMutation.mutateAsync({ id: editingOlt.id, data })
        toast.success('OLT updated successfully')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('OLT created successfully')
      }
      handleCloseDialog()
    } catch (error) {
      // Error already handled by mutations
    }
  }

  const handleDelete = (id?: string) => {
    if (id) {
      setOltToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = () => {
    if (oltToDelete) {
      deleteMutation.mutate(oltToDelete)
      setDeleteDialogOpen(false)
      setOltToDelete(null)
    }
  }

  const handleRestore = (oltId: string) => {
    setOltToRestore(oltId)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (oltToRestore) {
      restoreMutation.mutate(oltToRestore)
      setRestoreDialogOpen(false)
      setOltToRestore(null)
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
      const blob = await oltApi.exportToCsv(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `olts_${new Date().toISOString().split('T')[0]}.csv`
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
      const blob = await oltApi.exportToExcel(
        searchQuery || undefined,
        sortField || undefined,
        sortDirection
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `olts_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'default',
      inactive: 'secondary',
      maintenance: 'outline',
      faulty: 'destructive',
    }
    return colors[status] || 'secondary'
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Antenna className="h-8 w-8" />
            OLTs
          </h1>
          <p className="text-muted-foreground">Manage Optical Line Terminals</p>
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
              Add OLT
            </Button>
          )}
        </div>
      </div>
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [oltToDelete, setOltToDelete] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [oltToRestore, setOltToRestore] = useState<string | null>(null)
