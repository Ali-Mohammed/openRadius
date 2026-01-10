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
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function Olts() {
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

  // OLT state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOlt, setEditingOlt] = useState<Olt | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [oltToDelete, setOltToDelete] = useState<string | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [oltToRestore, setOltToRestore] = useState<string | null>(null)
  
  // PON Port state
  const [ponPortDialogOpen, setPonPortDialogOpen] = useState(false)
  const [selectedOltForPonPorts, setSelectedOltForPonPorts] = useState<Olt | null>(null)
  const [ponPortFormOpen, setPonPortFormOpen] = useState(false)
  const [editingPonPort, setEditingPonPort] = useState<any | null>(null)
  const [ponPortDeleteDialogOpen, setPonPortDeleteDialogOpen] = useState(false)
  const [ponPortToDelete, setPonPortToDelete] = useState<string | null>(null)
  const [ponPortFormData, setPonPortFormData] = useState({
    slot: '',
    port: '',
    technology: 'GPON',
    maxSplitRatio: '',
    currentSplitRatio: '',
    txPowerDbm: '',
    rxPowerDbm: '',
    status: 'active',
  })
  
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
    assetTag: '',
    role: '',
    managementIp: '',
    managementVlan: '',
    loopbackIp: '',
    mgmtInterface: '',
    siteName: '',
    rack: '',
    rackUnit: '',
    status: 'active',
    environment: 'prod',
    sshEnabled: true,
    sshPort: '22',
    sshUsername: '',
    sshPassword: '',
    snmpVersion: 'v2c',
    snmpPort: '161',
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

  // Virtual scrolling - optimized for large datasets
  const rowVirtualizer = useVirtualizer({
    count: olts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approximate row height in pixels
    overscan: 2, // Reduced overscan for better performance with large datasets
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

  // PON Port Queries and Mutations
  const { data: ponPorts = [], refetch: refetchPonPorts } = useQuery({
    queryKey: ['ponPorts', selectedOltForPonPorts?.id],
    queryFn: () => selectedOltForPonPorts ? oltApi.getOltPonPorts(selectedOltForPonPorts.id) : Promise.resolve([]),
    enabled: !!selectedOltForPonPorts,
  })

  const createPonPortMutation = useMutation({
    mutationFn: ({ oltId, data }: { oltId: string; data: any }) => 
      oltApi.createPonPort(oltId, data),
    onSuccess: () => {
      refetchPonPorts()
      queryClient.invalidateQueries({ queryKey: ['olts'] })
      toast.success('PON port created successfully')
      setPonPortFormOpen(false)
      resetPonPortForm()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create PON port')
    },
  })

  const updatePonPortMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      oltApi.updatePonPort(id, data),
    onSuccess: () => {
      refetchPonPorts()
      queryClient.invalidateQueries({ queryKey: ['olts'] })
      toast.success('PON port updated successfully')
      setPonPortFormOpen(false)
      resetPonPortForm()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update PON port')
    },
  })

  const deletePonPortMutation = useMutation({
    mutationFn: (id: string) => oltApi.deletePonPort(id),
    onSuccess: () => {
      refetchPonPorts()
      queryClient.invalidateQueries({ queryKey: ['olts'] })
      toast.success('PON port deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete PON port')
    },
  })

  // Handlers
  const handleOpenDialog = (olt?: Olt) => {
    if (olt) {
      setEditingOlt(olt)
      setFormData({
        name: olt.name || '',
        hostname: olt.hostname || '',
        vendor: olt.vendor || '',
        model: olt.model || '',
        serialNumber: olt.serialNumber || '',
        assetTag: '',
        role: '',
        managementIp: olt.managementIp || '',
        managementVlan: olt.managementVlan?.toString() || '',
        loopbackIp: '',
        mgmtInterface: '',
        siteName: olt.siteName || '',
        rack: '',
        rackUnit: '',
        status: olt.status || 'active',
        environment: olt.environment || 'prod',
        sshEnabled: true,
        sshPort: '22',
        sshUsername: '',
        sshPassword: '',
        snmpVersion: 'v2c',
        snmpPort: '161',
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
        assetTag: '',
        role: '',
        managementIp: '',
        managementVlan: '',
        loopbackIp: '',
        mgmtInterface: '',
        siteName: '',
        rack: '',
        rackUnit: '',
        status: 'active',
        environment: 'prod',
        sshEnabled: false,
        sshPort: '22',
        sshUsername: '',
        sshPassword: '',
        snmpVersion: '',
        snmpPort: '161',
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
      assetTag: formData.assetTag || undefined,
      role: formData.role || undefined,
      managementIp: formData.managementIp,
      managementVlan: formData.managementVlan ? parseInt(formData.managementVlan) : undefined,
      loopbackIp: formData.loopbackIp || undefined,
      mgmtInterface: formData.mgmtInterface || undefined,
      siteName: formData.siteName || undefined,
      rack: formData.rack || undefined,
      rackUnit: formData.rackUnit ? parseInt(formData.rackUnit) : undefined,
      status: formData.status,
      environment: formData.environment,
      sshEnabled: formData.sshEnabled,
      sshPort: parseInt(formData.sshPort) || 22,
      sshUsername: formData.sshUsername || undefined,
      sshPassword: formData.sshPassword || undefined,
      snmpVersion: formData.snmpVersion || undefined,
      snmpPort: parseInt(formData.snmpPort) || 161,
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

  // PON Port Handlers
  const handleOpenPonPortDialog = (olt: Olt) => {
    setSelectedOltForPonPorts(olt)
    setPonPortDialogOpen(true)
  }

  const handleClosePonPortDialog = () => {
    setPonPortDialogOpen(false)
    setSelectedOltForPonPorts(null)
  }

  const resetPonPortForm = () => {
    setPonPortFormData({
      slot: '',
      port: '',
      technology: 'GPON',
      maxSplitRatio: '',
      currentSplitRatio: '',
      txPowerDbm: '',
      rxPowerDbm: '',
      status: 'active',
    })
    setEditingPonPort(null)
  }

  const handleOpenPonPortForm = (ponPort?: any) => {
    if (ponPort) {
      setEditingPonPort(ponPort)
      setPonPortFormData({
        slot: ponPort.slot.toString(),
        port: ponPort.port.toString(),
        technology: ponPort.technology,
        maxSplitRatio: ponPort.maxSplitRatio?.toString() || '',
        currentSplitRatio: ponPort.currentSplitRatio?.toString() || '',
        txPowerDbm: ponPort.txPowerDbm?.toString() || '',
        rxPowerDbm: ponPort.rxPowerDbm?.toString() || '',
        status: ponPort.status,
      })
    } else {
      resetPonPortForm()
    }
    setPonPortFormOpen(true)
  }

  const handleSubmitPonPort = () => {
    if (!selectedOltForPonPorts) return

    const data = {
      slot: parseInt(ponPortFormData.slot),
      port: parseInt(ponPortFormData.port),
      technology: ponPortFormData.technology,
      maxSplitRatio: ponPortFormData.maxSplitRatio ? parseInt(ponPortFormData.maxSplitRatio) : undefined,
      currentSplitRatio: ponPortFormData.currentSplitRatio ? parseInt(ponPortFormData.currentSplitRatio) : undefined,
      txPowerDbm: ponPortFormData.txPowerDbm ? parseFloat(ponPortFormData.txPowerDbm) : undefined,
      rxPowerDbm: ponPortFormData.rxPowerDbm ? parseFloat(ponPortFormData.rxPowerDbm) : undefined,
      status: ponPortFormData.status,
    }

    if (editingPonPort) {
      updatePonPortMutation.mutate({ id: editingPonPort.id, data })
    } else {
      createPonPortMutation.mutate({ oltId: selectedOltForPonPorts.id, data })
    }
  }

  const handleDeletePonPort = (ponPortId: string) => {
    setPonPortToDelete(ponPortId)
    setPonPortDeleteDialogOpen(true)
  }

  const confirmDeletePonPort = () => {
    if (ponPortToDelete) {
      deletePonPortMutation.mutate(ponPortToDelete)
      setPonPortDeleteDialogOpen(false)
      setPonPortToDelete(null)
    }
  }

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }, [sortField, sortDirection])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

  // Generate pagination page numbers
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7 // Maximum number of page buttons to show
    
    if (total <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      // Show pages around current page
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      // Always show last page
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
    setCurrentPage(1) // Reset to first page on new search
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1) // Reset to first page
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
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
      case 'faulty':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getEnvironmentBadgeVariant = (environment: string) => {
    switch (environment) {
      case 'prod':
        return 'default'
      case 'dev':
        return 'outline'
      case 'test':
        return 'secondary'
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
          <h1 className="text-3xl font-bold">OLTs</h1>
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

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Search OLTs..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="max-w-sm"
                />
                <Button onClick={handleSearch} variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
                <Button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['olts', currentWorkspaceId] })} 
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
                          name: checked,
                          vendor: checked,
                          model: checked,
                          serialNumber: checked,
                          managementIp: checked,
                          hostname: checked,
                          status: checked,
                          environment: checked,
                          siteName: checked,
                          ponPortCount: checked,
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
                      checked={columnVisibility.name}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, name: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.vendor}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, vendor: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Vendor
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.model}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, model: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Model
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.serialNumber}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, serialNumber: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Serial Number
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.managementIp}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, managementIp: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Management IP
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.hostname}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, hostname: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Hostname
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.status}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.environment}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, environment: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Environment
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.siteName}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, siteName: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      Site Name
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.ponPortCount}
                      onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, ponPortCount: checked }))}
                      onSelect={(e) => e.preventDefault()}
                    >
                      PON Ports
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
                    <TableHead className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-24" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="sticky right-0 bg-background h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4 w-[150px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-full" /></TableCell>
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
          ) : olts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No OLTs found
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
                {/* Fixed Header */}
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                      {columnVisibility.name && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[150px] cursor-pointer select-none" onClick={() => handleSort('name')}>Name{getSortIcon('name')}</TableHead>}
                      {columnVisibility.vendor && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('vendor')}>Vendor{getSortIcon('vendor')}</TableHead>}
                      {columnVisibility.model && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('model')}>Model{getSortIcon('model')}</TableHead>}
                      {columnVisibility.serialNumber && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[150px] cursor-pointer select-none" onClick={() => handleSort('serialNumber')}>Serial Number{getSortIcon('serialNumber')}</TableHead>}
                      {columnVisibility.managementIp && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('managementIp')}>Management IP{getSortIcon('managementIp')}</TableHead>}
                      {columnVisibility.hostname && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[150px] cursor-pointer select-none" onClick={() => handleSort('hostname')}>Hostname{getSortIcon('hostname')}</TableHead>}
                      {columnVisibility.status && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('status')}>Status{getSortIcon('status')}</TableHead>}
                      {columnVisibility.environment && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('environment')}>Environment{getSortIcon('environment')}</TableHead>}
                      {columnVisibility.siteName && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[140px] cursor-pointer select-none" onClick={() => handleSort('siteName')}>Site Name{getSortIcon('siteName')}</TableHead>}
                      {columnVisibility.ponPortCount && <TableHead className="h-12 px-4 font-semibold text-right whitespace-nowrap w-[100px] cursor-pointer select-none" onClick={() => handleSort('ponPortCount')}>PON Ports{getSortIcon('ponPortCount')}</TableHead>}
                      {columnVisibility.createdAt && <TableHead className="h-12 px-4 font-semibold whitespace-nowrap w-[120px] cursor-pointer select-none" onClick={() => handleSort('createdAt')}>Created At{getSortIcon('createdAt')}</TableHead>}
                      <TableHead className="sticky right-0 bg-muted shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 font-semibold text-right whitespace-nowrap w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                
                {/* Scrollable Body */}
                <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const olt = olts[virtualRow.index]
                        return (
                          <TableRow 
                            key={olt.id}
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
                          {columnVisibility.name && <TableCell className="h-12 px-4 font-medium whitespace-nowrap w-[150px]">{olt.name}</TableCell>}
                          {columnVisibility.vendor && <TableCell className="h-12 px-4 w-[140px]">{olt.vendor || '-'}</TableCell>}
                          {columnVisibility.model && <TableCell className="h-12 px-4 w-[140px]">{olt.model || '-'}</TableCell>}
                          {columnVisibility.serialNumber && <TableCell className="h-12 px-4 w-[150px]">{olt.serialNumber || '-'}</TableCell>}
                          {columnVisibility.managementIp && <TableCell className="h-12 px-4 w-[140px]">{olt.managementIp || '-'}</TableCell>}
                          {columnVisibility.hostname && <TableCell className="h-12 px-4 w-[150px]">{olt.hostname || '-'}</TableCell>}
                          {columnVisibility.status && <TableCell className="h-12 px-4 w-[120px]">
                            <Badge variant={getStatusBadgeVariant(olt.status || 'inactive')}>
                              {olt.status || 'inactive'}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.environment && <TableCell className="h-12 px-4 w-[120px]">
                            <Badge variant={getEnvironmentBadgeVariant(olt.environment || 'prod')}>
                              {olt.environment || 'prod'}
                            </Badge>
                          </TableCell>}
                          {columnVisibility.siteName && <TableCell className="h-12 px-4 w-[140px]">{olt.siteName || '-'}</TableCell>}
                          {columnVisibility.ponPortCount && <TableCell className="h-12 px-4 text-right w-[100px]">{olt.ponPortCount || '0'}</TableCell>}
                          {columnVisibility.createdAt && <TableCell className="h-12 px-4 w-[120px]">{formatDate(olt.createdAt)}</TableCell>}
                          <TableCell className="sticky right-0 bg-card shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] h-12 px-4 text-right w-[120px]">
                            <div className="flex justify-end gap-2">
                              {showTrash ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRestore(olt.id!)}
                                  disabled={restoreMutation.isPending}
                                  title="Restore OLT"
                                >
                                  <RotateCcw className="h-4 w-4 text-green-600" />
                                </Button>
                              ) : (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleOpenPonPortDialog(olt)}
                                    title="Manage PON Ports"
                                  >
                                    <Antenna className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(olt)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(olt.id)}
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
          
          {/* Pagination Controls - Always visible */}
          {pagination && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <div className="text-sm text-muted-foreground">
                Showing {formatNumber(olts.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + olts.length)} of {formatNumber(pagination.totalRecords)} OLTs
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

      {/* OLT Dialog */}
      {isDialogOpen && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOlt ? 'Edit OLT' : 'Add OLT'}</DialogTitle>
            <DialogDescription>
              {editingOlt ? 'Update OLT details' : 'Fill in the details to create a new OLT'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., OLT-Main-Building"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hostname">Hostname</Label>
                <Input
                  id="hostname"
                  value={formData.hostname}
                  onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                  placeholder="e.g., olt-main.company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="e.g., Huawei, ZTE, Nokia"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g., MA5800-X7"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="e.g., SN123456789"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assetTag">Asset Tag</Label>
                <Input
                  id="assetTag"
                  value={formData.assetTag}
                  onChange={(e) => setFormData({ ...formData, assetTag: e.target.value })}
                  placeholder="e.g., ASSET-001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Core, Distribution, Access"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="managementIp">Management IP *</Label>
                <Input
                  id="managementIp"
                  value={formData.managementIp}
                  onChange={(e) => setFormData({ ...formData, managementIp: e.target.value })}
                  placeholder="e.g., 192.168.1.1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="managementVlan">Management VLAN</Label>
                <Input
                  id="managementVlan"
                  type="number"
                  value={formData.managementVlan}
                  onChange={(e) => setFormData({ ...formData, managementVlan: e.target.value })}
                  placeholder="e.g., 100"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="loopbackIp">Loopback IP</Label>
                <Input
                  id="loopbackIp"
                  value={formData.loopbackIp}
                  onChange={(e) => setFormData({ ...formData, loopbackIp: e.target.value })}
                  placeholder="e.g., 10.0.0.1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="mgmtInterface">Mgmt Interface</Label>
                <Input
                  id="mgmtInterface"
                  value={formData.mgmtInterface}
                  onChange={(e) => setFormData({ ...formData, mgmtInterface: e.target.value })}
                  placeholder="e.g., eth0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="siteName">Site Name</Label>
                <Input
                  id="siteName"
                  value={formData.siteName}
                  onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
                  placeholder="e.g., Main Office"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rack">Rack</Label>
                <Input
                  id="rack"
                  value={formData.rack}
                  onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                  placeholder="e.g., R01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rackUnit">Rack Unit (U)</Label>
                <Input
                  id="rackUnit"
                  type="number"
                  value={formData.rackUnit}
                  onChange={(e) => setFormData({ ...formData, rackUnit: e.target.value })}
                  placeholder="e.g., 42"
                />
              </div>
              <div className="grid gap-2" />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="faulty">Faulty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="environment">Environment</Label>
                <Select value={formData.environment} onValueChange={(value) => setFormData({ ...formData, environment: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">Production</SelectItem>
                    <SelectItem value="dev">Development</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="sshEnabled">SSH Enabled</Label>
                <Switch
                  id="sshEnabled"
                  checked={formData.sshEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, sshEnabled: checked })}
                />
              </div>
              
              {formData.sshEnabled && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sshPort">SSH Port</Label>
                    <Input
                      id="sshPort"
                      type="number"
                      value={formData.sshPort}
                      onChange={(e) => setFormData({ ...formData, sshPort: e.target.value })}
                      placeholder="22"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sshUsername">SSH Username</Label>
                    <Input
                      id="sshUsername"
                      value={formData.sshUsername}
                      onChange={(e) => setFormData({ ...formData, sshUsername: e.target.value })}
                      placeholder="admin"
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sshPassword">SSH Password</Label>
                    <Input
                      id="sshPassword"
                      type="password"
                      value={formData.sshPassword}
                      onChange={(e) => setFormData({ ...formData, sshPassword: e.target.value })}
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="snmpVersion">SNMP Version</Label>
                <Input
                  id="snmpVersion"
                  value={formData.snmpVersion}
                  onChange={(e) => setFormData({ ...formData, snmpVersion: e.target.value })}
                  placeholder="e.g., v2c, v3"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="snmpPort">SNMP Port</Label>
                <Input
                  id="snmpPort"
                  type="number"
                  value={formData.snmpPort}
                  onChange={(e) => setFormData({ ...formData, snmpPort: e.target.value })}
                  placeholder="161"
                />
              </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
              {editingOlt ? 'Update' : 'Create'}
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
              This will move the OLT to trash. You can restore it later from the trash view.
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

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore OLT?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the OLT and make it available again.
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
