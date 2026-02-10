import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Activity,
  Shield,
  Clock,
  User,
  FileText,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import auditLogApi, { type AuditLogEntry } from '@/api/auditLogApi'

// ── Status helpers ──────────────────────────────────────────────────────────

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  Success: { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  Failure: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
  PartialSuccess: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
}

const categoryColors: Record<string, string> = {
  Billing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Payment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  UserManagement: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Network: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  System: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  Authentication: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Settings: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  RADIUS: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  Integration: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
}

const actionColors: Record<string, string> = {
  Create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Restore: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Activate: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Deactivate: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  Login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Logout: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  Export: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  Import: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ForceComplete: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  TopUp: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Deduct: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  StatusChange: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
}

function getStatusConfig(status: string) {
  return statusConfig[status] || { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted' }
}

function getCategoryColor(category: string) {
  return categoryColors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

function getActionColor(action: string) {
  return actionColors[action] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}

function formatDateTime(dateString: string) {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss')
  } catch {
    return dateString
  }
}

function formatRelativeTime(dateString: string) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return format(date, 'MMM dd, yyyy')
}

// Try to pretty-print JSON, fallback to raw string
function tryFormatJson(str?: string | null): string {
  if (!str) return ''
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

// ── Detail Dialog ───────────────────────────────────────────────────────────

function AuditLogDetail({ entry, open, onClose }: { entry: AuditLogEntry | null; open: boolean; onClose: () => void }) {
  if (!entry) return null

  const statusCfg = getStatusConfig(entry.status)
  const StatusIcon = statusCfg.icon

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit Log Detail
          </DialogTitle>
          <DialogDescription>
            {entry.description || `${entry.action} on ${entry.entityType}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <Badge className={getActionColor(entry.action)}>{entry.action}</Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Badge className={getCategoryColor(entry.category)}>{entry.category}</Badge>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Entity Type</Label>
              <p className="text-sm font-medium">{entry.entityType}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {entry.status}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Timestamp</Label>
              <p className="text-sm">{formatDateTime(entry.createdAt)}</p>
            </div>
            {entry.entityUuid && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Entity UUID</Label>
                <p className="text-xs font-mono text-muted-foreground break-all">{entry.entityUuid}</p>
              </div>
            )}
          </div>

          {/* Users */}
          <div className="grid grid-cols-2 gap-4">
            {entry.performedBy && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4" /> Performed By
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="font-medium">{entry.performedBy.fullName || 'System'}</p>
                  {entry.performedBy.email && <p className="text-xs text-muted-foreground">{entry.performedBy.email}</p>}
                </CardContent>
              </Card>
            )}
            {entry.targetUser && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <User className="h-4 w-4" /> Target User
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="font-medium">{entry.targetUser.fullName}</p>
                  {entry.targetUser.email && <p className="text-xs text-muted-foreground">{entry.targetUser.email}</p>}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Description & Reason */}
          {(entry.description || entry.reason) && (
            <div className="space-y-3">
              {entry.description && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm">{entry.description}</p>
                </div>
              )}
              {entry.reason && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reason</Label>
                  <p className="text-sm">{entry.reason}</p>
                </div>
              )}
            </div>
          )}

          {entry.errorMessage && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Error Message</Label>
              <p className="text-sm text-red-600 dark:text-red-400">{entry.errorMessage}</p>
            </div>
          )}

          {/* Data Tabs */}
          {(entry.previousData || entry.newData || entry.changes || entry.metadata) && (
            <Tabs defaultValue={entry.changes ? 'changes' : entry.newData ? 'newData' : 'previousData'}>
              <TabsList>
                {entry.changes && <TabsTrigger value="changes">Changes</TabsTrigger>}
                {entry.previousData && <TabsTrigger value="previousData">Before</TabsTrigger>}
                {entry.newData && <TabsTrigger value="newData">After</TabsTrigger>}
                {entry.metadata && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
              </TabsList>
              {entry.changes && (
                <TabsContent value="changes">
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-64">{tryFormatJson(entry.changes)}</pre>
                </TabsContent>
              )}
              {entry.previousData && (
                <TabsContent value="previousData">
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-64">{tryFormatJson(entry.previousData)}</pre>
                </TabsContent>
              )}
              {entry.newData && (
                <TabsContent value="newData">
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-64">{tryFormatJson(entry.newData)}</pre>
                </TabsContent>
              )}
              {entry.metadata && (
                <TabsContent value="metadata">
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-64">{tryFormatJson(entry.metadata)}</pre>
                </TabsContent>
              )}
            </Tabs>
          )}

          {/* Technical Context */}
          {(entry.ipAddress || entry.userAgent || entry.requestPath || entry.correlationId) && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium text-muted-foreground">Technical Details</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {entry.requestPath && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Request</Label>
                    <p className="font-mono">{entry.requestPath}</p>
                  </div>
                )}
                {entry.ipAddress && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">IP Address</Label>
                    <p className="font-mono">{entry.ipAddress}</p>
                  </div>
                )}
                {entry.correlationId && (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">Correlation ID</Label>
                    <p className="font-mono break-all">{entry.correlationId}</p>
                  </div>
                )}
                {entry.userAgent && (
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground">User Agent</Label>
                    <p className="font-mono break-all">{entry.userAgent}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function AuditLogs() {
  // ── State ──
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntityType, setFilterEntityType] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortField, setSortField] = useState<string>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Debounce search input
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const handleSearch = (value: string) => {
    setSearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      setDebouncedSearch(value)
      setCurrentPage(1)
    }, 400)
    setSearchTimeout(timeout)
  }

  // ── Queries ──
  const { data: logsData, isLoading, isFetching } = useQuery({
    queryKey: ['auditLogs', debouncedSearch, filterAction, filterEntityType, filterCategory, filterStatus, startDate, endDate, currentPage, pageSize, sortField, sortDirection],
    queryFn: () =>
      auditLogApi.getAll({
        search: debouncedSearch || undefined,
        action: filterAction || undefined,
        entityType: filterEntityType || undefined,
        category: filterCategory || undefined,
        status: filterStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        pageSize,
        sortField,
        sortDirection,
      }),
  })

  const { data: stats } = useQuery({
    queryKey: ['auditLogs', 'stats', filterCategory, startDate, endDate],
    queryFn: () =>
      auditLogApi.getStats({
        category: filterCategory || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  })

  const { data: categories } = useQuery({
    queryKey: ['auditLogs', 'categories'],
    queryFn: auditLogApi.getCategories,
    staleTime: 60000,
  })

  const { data: actions } = useQuery({
    queryKey: ['auditLogs', 'actions'],
    queryFn: auditLogApi.getActions,
    staleTime: 60000,
  })

  const { data: entityTypes } = useQuery({
    queryKey: ['auditLogs', 'entityTypes'],
    queryFn: auditLogApi.getEntityTypes,
    staleTime: 60000,
  })

  const logs = logsData?.data || []
  const totalCount = logsData?.totalCount || 0
  const totalPages = logsData?.totalPages || 1

  const activeFilterCount = useMemo(() =>
    [filterAction, filterEntityType, filterCategory, filterStatus, startDate, endDate].filter(Boolean).length,
    [filterAction, filterEntityType, filterCategory, filterStatus, startDate, endDate]
  )

  const clearFilters = () => {
    setFilterAction('')
    setFilterEntityType('')
    setFilterCategory('')
    setFilterStatus('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />
  }

  const handleViewDetail = (entry: AuditLogEntry) => {
    setSelectedEntry(entry)
    setDetailOpen(true)
  }

  // Pagination helpers
  const startRecord = totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const endRecord = Math.min(currentPage * pageSize, totalCount)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-8 w-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            View all system activity and changes across the platform
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Entries</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayEntries.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byCategory.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Actions</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failedEntries.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search audit logs..."
              className="pl-8"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                onClick={() => { setSearch(''); setDebouncedSearch(''); setCurrentPage(1) }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3 w-3" />
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              // Trigger react-query refetch by changing a key
            }}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">{activeFilterCount}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filters</h4>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={filterCategory || 'all'} onValueChange={(v) => { setFilterCategory(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {(categories || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={filterAction || 'all'} onValueChange={(v) => { setFilterAction(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      {(actions || []).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Entity Type</Label>
                  <Select value={filterEntityType || 'all'} onValueChange={(v) => { setFilterEntityType(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger><SelectValue placeholder="All Entity Types" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {(entityTypes || []).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setCurrentPage(1) }}>
                    <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="Success">Success</SelectItem>
                      <SelectItem value="Failure">Failure</SelectItem>
                      <SelectItem value="PartialSuccess">Partial Success</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }} />
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }} />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('createdAt')}>
                  Timestamp
                  <SortIcon field="createdAt" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('category')}>
                  Category
                  <SortIcon field="category" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('action')}>
                  Action
                  <SortIcon field="action" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('entityType')}>
                  Entity Type
                  <SortIcon field="entityType" />
                </Button>
              </TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('status')}>
                  Status
                  <SortIcon field="status" />
                </Button>
              </TableHead>
              <TableHead className="w-[60px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ScrollText className="h-10 w-10 text-muted-foreground/40" />
                    <p>No audit log entries found</p>
                    {(debouncedSearch || activeFilterCount > 0) && (
                      <Button variant="outline" size="sm" onClick={() => { setSearch(''); setDebouncedSearch(''); clearFilters() }}>
                        Clear all filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((entry) => {
                const statusCfg = getStatusConfig(entry.status)
                const StatusIcon = statusCfg.icon
                return (
                  <TableRow
                    key={entry.uuid}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetail(entry)}
                  >
                    <TableCell className="font-mono text-xs">
                      <div>{formatRelativeTime(entry.createdAt)}</div>
                      <div className="text-muted-foreground">{format(new Date(entry.createdAt), 'HH:mm:ss')}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoryColor(entry.category)}>
                        {entry.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getActionColor(entry.action)}>
                        {entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.entityType}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                      {entry.description || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.performedBy ? (
                        <div>
                          <div className="font-medium">{entry.performedBy.fullName || 'Unknown'}</div>
                          {entry.performedBy.email && (
                            <div className="text-xs text-muted-foreground">{entry.performedBy.email}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {entry.status}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleViewDetail(entry) }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startRecord} to {endRecord} of {totalCount.toLocaleString()} entries
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 px-2">
              <span className="text-sm">Page</span>
              <Input
                className="h-8 w-14 text-center"
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val)
                }}
              />
              <span className="text-sm">of {totalPages}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <AuditLogDetail
        entry={selectedEntry}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  )
}
