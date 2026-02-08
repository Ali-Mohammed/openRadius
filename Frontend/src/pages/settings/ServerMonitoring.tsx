import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Container,
  Play,
  Square,
  RotateCcw,
  ScrollText,
  RefreshCw,
  Server,
  Activity,
  Clock,
  MoreVertical,
  Gauge,
  Box,
  Info,
  Download,
} from 'lucide-react'
import {
  serverMonitoringApi,
  type ContainerInfo,
} from '@/api/serverMonitoringApi'

// ── Helpers ─────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

function getStateColor(state: string): string {
  switch (state?.toLowerCase()) {
    case 'running':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    case 'exited':
    case 'dead':
      return 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
    case 'paused':
      return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
    case 'restarting':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
    case 'created':
      return 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ServerMonitoring() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null)
  const [logDialog, setLogDialog] = useState(false)
  const [logTail, setLogTail] = useState(200)
  const [actionDialog, setActionDialog] = useState<{ container: ContainerInfo; action: 'start' | 'stop' | 'restart' } | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // ── Data Fetching ───────────────────────────────────────────────────

  const { data: resources, isLoading: resourcesLoading, isFetching: resourcesFetching } = useQuery({
    queryKey: ['server-resources'],
    queryFn: serverMonitoringApi.getServerResources,
    refetchInterval: autoRefresh ? 10000 : false,
    staleTime: 5000,
  })

  const { data: containers = [], isLoading: containersLoading, isFetching: containersFetching } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: () => serverMonitoringApi.getContainers(true),
    refetchInterval: autoRefresh ? 10000 : false,
    staleTime: 5000,
  })

  const { data: dockerInfo, isLoading: dockerInfoLoading } = useQuery({
    queryKey: ['docker-info'],
    queryFn: serverMonitoringApi.getDockerInfo,
    staleTime: 30000,
  })

  const { data: containerLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['container-logs', selectedContainer?.id, logTail],
    queryFn: () => selectedContainer ? serverMonitoringApi.getContainerLogs(selectedContainer.id, logTail) : null,
    enabled: !!selectedContainer && logDialog,
    staleTime: 0,
  })

  // ── Mutations ───────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: serverMonitoringApi.startContainer,
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to start container'),
  })

  const stopMutation = useMutation({
    mutationFn: serverMonitoringApi.stopContainer,
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to stop container'),
  })

  const restartMutation = useMutation({
    mutationFn: serverMonitoringApi.restartContainer,
    onSuccess: (result) => {
      toast.success(result.message)
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to restart container'),
  })

  const isActionPending = startMutation.isPending || stopMutation.isPending || restartMutation.isPending

  // ── Handlers ────────────────────────────────────────────────────────

  const handleContainerAction = useCallback(() => {
    if (!actionDialog) return
    const { container, action } = actionDialog
    switch (action) {
      case 'start':
        startMutation.mutate(container.id)
        break
      case 'stop':
        stopMutation.mutate(container.id)
        break
      case 'restart':
        restartMutation.mutate(container.id)
        break
    }
    setActionDialog(null)
  }, [actionDialog, startMutation, stopMutation, restartMutation])

  const handleViewLogs = (container: ContainerInfo) => {
    setSelectedContainer(container)
    setLogDialog(true)
  }

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['server-resources'] })
    queryClient.invalidateQueries({ queryKey: ['docker-containers'] })
    queryClient.invalidateQueries({ queryKey: ['docker-info'] })
  }

  const handleDownloadLogs = () => {
    if (!containerLogs?.logs?.length) return
    const blob = new Blob([containerLogs.logs.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${containerLogs.containerName || 'container'}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────

  const runningCount = containers.filter(c => c.state === 'running').length
  const stoppedCount = containers.filter(c => c.state !== 'running').length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Server Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Monitor server resources, Docker containers, and view logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoRefresh ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
                  <span className="ml-1 hidden sm:inline">{autoRefresh ? 'Live' : 'Paused'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {autoRefresh ? 'Auto-refresh every 10s (click to pause)' : 'Click to enable auto-refresh'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={resourcesFetching || containersFetching}
          >
            <RefreshCw className={`h-4 w-4 ${(resourcesFetching || containersFetching) ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Gauge className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="containers" className="gap-1.5">
            <Container className="h-4 w-4" />
            Containers
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {containers.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="docker" className="gap-1.5">
            <Info className="h-4 w-4" />
            Docker Info
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Resource Cards */}
          {resourcesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-20" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-2 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : resources ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* CPU */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">CPU Usage</CardTitle>
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{resources.cpu.usagePercent}%</div>
                    <div className="mt-2">
                      <Progress
                        value={resources.cpu.usagePercent}
                        className="h-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {resources.cpu.cores} cores • {resources.cpu.model || 'Unknown'}
                    </p>
                  </CardContent>
                </Card>

                {/* Memory */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
                    <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{resources.memory.usagePercent}%</div>
                    <div className="mt-2">
                      <Progress
                        value={resources.memory.usagePercent}
                        className="h-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatBytes(resources.memory.usedBytes)} / {formatBytes(resources.memory.totalBytes)}
                    </p>
                  </CardContent>
                </Card>

                {/* Disk */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Disk</CardTitle>
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{resources.disk.usagePercent}%</div>
                    <div className="mt-2">
                      <Progress
                        value={resources.disk.usagePercent}
                        className="h-2"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatBytes(resources.disk.usedBytes)} / {formatBytes(resources.disk.totalBytes)}
                    </p>
                  </CardContent>
                </Card>

                {/* System Info */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">System</CardTitle>
                    <Server className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold truncate">{resources.hostname}</div>
                    <div className="space-y-1 mt-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Uptime: {resources.uptime}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>Load: {resources.loadAverage1} / {resources.loadAverage5} / {resources.loadAverage15}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {resources.kernel}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Container Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Containers</CardTitle>
                    <Container className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{containers.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Running</CardTitle>
                    <Play className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{runningCount}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Stopped</CardTitle>
                    <Square className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stoppedCount}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Container List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Containers</CardTitle>
                      <CardDescription>Quick overview of all Docker containers</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('containers')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {containers.slice(0, 8).map(container => (
                      <div
                        key={container.id}
                        className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${container.state === 'running' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{container.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{container.image}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {container.state === 'running' && (
                            <span className="text-xs text-muted-foreground hidden md:inline">
                              CPU: {container.resources.cpuPercent} • Mem: {container.resources.memoryUsage}
                            </span>
                          )}
                          <Badge variant="outline" className={`text-xs ${getStateColor(container.state)}`}>
                            {container.state}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Unable to fetch server resources</h3>
                <p className="text-muted-foreground text-sm">
                  Make sure the Docker socket is mounted and the server is reachable.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Containers Tab ───────────────────────────────────────── */}
        <TabsContent value="containers" className="space-y-4 mt-4">
          {containersLoading ? (
            <Card>
              <CardContent className="p-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-60 ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : containers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Container className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No containers found</h3>
                <p className="text-muted-foreground text-sm">
                  Docker containers will appear here when they're available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">State</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead className="hidden lg:table-cell">Image</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="hidden xl:table-cell">CPU</TableHead>
                      <TableHead className="hidden xl:table-cell">Memory</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Net I/O</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Block I/O</TableHead>
                      <TableHead className="hidden 2xl:table-cell">PIDs</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {containers.map(container => (
                      <TableRow key={container.id}>
                        <TableCell>
                          <div className={`h-2.5 w-2.5 rounded-full ${container.state === 'running' ? 'bg-emerald-500' : container.state === 'paused' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{container.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{container.shortId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <p className="text-sm truncate max-w-[200px]" title={container.image}>
                            {container.image}
                          </p>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={`text-xs ${getStateColor(container.state)}`}>
                            {container.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <span className="text-sm font-mono">
                            {container.state === 'running' ? container.resources.cpuPercent : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div>
                            <span className="text-sm font-mono">
                              {container.state === 'running' ? container.resources.memoryUsage : '—'}
                            </span>
                            {container.state === 'running' && container.resources.memoryPercent > 0 && (
                              <Progress
                                value={container.resources.memoryPercent}
                                className="h-1 mt-1 w-20"
                              />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <span className="text-xs font-mono text-muted-foreground">
                            {container.state === 'running' ? container.resources.netIO : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <span className="text-xs font-mono text-muted-foreground">
                            {container.state === 'running' ? container.resources.blockIO : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <span className="text-sm font-mono">
                            {container.state === 'running' ? container.resources.pids : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {container.state !== 'running' && (
                                <DropdownMenuItem
                                  onClick={() => setActionDialog({ container, action: 'start' })}
                                  disabled={isActionPending}
                                >
                                  <Play className="h-4 w-4 mr-2 text-emerald-500" />
                                  Start
                                </DropdownMenuItem>
                              )}
                              {container.state === 'running' && (
                                <DropdownMenuItem
                                  onClick={() => setActionDialog({ container, action: 'stop' })}
                                  disabled={isActionPending}
                                >
                                  <Square className="h-4 w-4 mr-2 text-red-500" />
                                  Stop
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setActionDialog({ container, action: 'restart' })}
                                disabled={isActionPending}
                              >
                                <RotateCcw className="h-4 w-4 mr-2 text-blue-500" />
                                Restart
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleViewLogs(container)}>
                                <ScrollText className="h-4 w-4 mr-2" />
                                View Logs
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Docker Info Tab ──────────────────────────────────────── */}
        <TabsContent value="docker" className="space-y-4 mt-4">
          {dockerInfoLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-6 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : dockerInfo ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoCard title="Docker Version" value={dockerInfo.serverVersion} icon={<Box className="h-4 w-4" />} />
              <InfoCard title="API Version" value={dockerInfo.apiVersion} icon={<Info className="h-4 w-4" />} />
              <InfoCard title="Operating System" value={dockerInfo.operatingSystem} icon={<Server className="h-4 w-4" />} />
              <InfoCard title="Architecture" value={dockerInfo.architecture} icon={<Cpu className="h-4 w-4" />} />
              <InfoCard title="Kernel" value={dockerInfo.kernelVersion} icon={<Activity className="h-4 w-4" />} />
              <InfoCard title="CPUs" value={String(dockerInfo.cpus)} icon={<Cpu className="h-4 w-4" />} />
              <InfoCard title="Total Memory" value={dockerInfo.totalMemory} icon={<MemoryStick className="h-4 w-4" />} />
              <InfoCard title="Storage Driver" value={dockerInfo.storageDriver} icon={<HardDrive className="h-4 w-4" />} />
              <InfoCard title="Docker Root" value={dockerInfo.dockerRootDir} icon={<HardDrive className="h-4 w-4" />} />
              <InfoCard title="Total Containers" value={String(dockerInfo.totalContainers)} icon={<Container className="h-4 w-4" />} />
              <InfoCard title="Running" value={String(dockerInfo.runningContainers)} icon={<Play className="h-4 w-4 text-emerald-500" />} />
              <InfoCard title="Images" value={String(dockerInfo.images)} icon={<Box className="h-4 w-4" />} />
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Box className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Docker info unavailable</h3>
                <p className="text-muted-foreground text-sm">
                  Cannot connect to Docker daemon. Ensure the Docker socket is mounted.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Container Action Confirmation ──────────────────────────── */}
      <AlertDialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog?.action === 'start' && 'Start Container'}
              {actionDialog?.action === 'stop' && 'Stop Container'}
              {actionDialog?.action === 'restart' && 'Restart Container'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to <strong>{actionDialog?.action}</strong> the container{' '}
              <strong className="font-mono">{actionDialog?.container.name}</strong>?
              {actionDialog?.action === 'stop' && (
                <span className="block mt-2 text-yellow-600 dark:text-yellow-400">
                  ⚠️ Stopping this container may affect running services.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleContainerAction}
              className={
                actionDialog?.action === 'stop'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : ''
              }
            >
              {actionDialog?.action === 'start' && 'Start'}
              {actionDialog?.action === 'stop' && 'Stop'}
              {actionDialog?.action === 'restart' && 'Restart'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Log Viewer Dialog ──────────────────────────────────────── */}
      <Dialog open={logDialog} onOpenChange={setLogDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Logs: {selectedContainer?.name}
            </DialogTitle>
            <DialogDescription>
              Container logs (last {logTail} lines)
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Select value={String(logTail)} onValueChange={(v) => setLogTail(Number(v))}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50 lines</SelectItem>
                <SelectItem value="100">100 lines</SelectItem>
                <SelectItem value="200">200 lines</SelectItem>
                <SelectItem value="500">500 lines</SelectItem>
                <SelectItem value="1000">1000 lines</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetchLogs()} disabled={logsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadLogs} disabled={!containerLogs?.logs?.length}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-zinc-950 dark:bg-zinc-950 p-4">
            {logsLoading ? (
              <div className="space-y-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-4 w-full bg-zinc-800" />
                ))}
              </div>
            ) : containerLogs?.logs?.length ? (
              <pre className="text-xs text-zinc-200 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {containerLogs.logs.map((line, i) => (
                  <div key={i} className="hover:bg-zinc-800/50 px-1 -mx-1 rounded">
                    <span className="text-zinc-500 select-none mr-3">{String(i + 1).padStart(4)}</span>
                    {line}
                  </div>
                ))}
              </pre>
            ) : (
              <div className="flex items-center justify-center h-32 text-zinc-500">
                No logs available
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground text-right pt-1">
            {containerLogs?.lineCount ?? 0} lines • Collected at{' '}
            {containerLogs?.collectedAt ? new Date(containerLogs.collectedAt).toLocaleTimeString() : '—'}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-Components ────────────────────────────────────────────────────────

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold truncate" title={value}>
          {value || '—'}
        </p>
      </CardContent>
    </Card>
  )
}
