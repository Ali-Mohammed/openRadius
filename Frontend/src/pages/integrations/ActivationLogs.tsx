import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { sasActivationsApi } from '@/api/sasActivationsApi';
import { sasRadiusApi } from '@/api/sasRadiusApi';
import { ActivationStatus } from '@/types/sasActivation';
import { formatDistance } from 'date-fns';
import { CheckCircle2, XCircle, Clock, Loader2, RotateCcw, AlertCircle, Ban, ChevronLeft, ChevronRight, ChevronsLeft, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

const statusConfig = {
  [ActivationStatus.Pending]: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700'
  },
  [ActivationStatus.Processing]: {
    label: 'Processing',
    icon: Loader2,
    variant: 'default' as const,
    className: 'bg-blue-100 text-blue-700'
  },
  [ActivationStatus.Success]: {
    label: 'Success',
    icon: CheckCircle2,
    variant: 'default' as const,
    className: 'bg-green-100 text-green-700'
  },
  [ActivationStatus.Failed]: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive' as const,
    className: 'bg-red-100 text-red-700'
  },
  [ActivationStatus.MaxRetriesReached]: {
    label: 'Max Retries',
    icon: AlertCircle,
    variant: 'destructive' as const,
    className: 'bg-orange-100 text-orange-700'
  },
  [ActivationStatus.Cancelled]: {
    label: 'Cancelled',
    icon: Ban,
    variant: 'secondary' as const,
    className: 'bg-gray-100 text-gray-700'
  }
};

export default function ActivationLogs() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [retryPeriod, setRetryPeriod] = useState<string>('1d');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Column widths
  const DEFAULT_COLUMN_WIDTHS = {
    timestamp: 180,
    user: 160,
    status: 140,
    duration: 120,
    retries: 100,
    error: 300,
    nextRetry: 140,
  };

  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<string | null>(null);

  // Fetch integration details
  const { data: integrationData } = useQuery({
    queryKey: ['sas-integration', integrationId],
    queryFn: async () => {
      if (!currentWorkspaceId) return null;
      const integrations = await sasRadiusApi.getAll(Number(currentWorkspaceId));
      return integrations.find(i => i.id && i.id.toString() === integrationId);
    },
    enabled: !!integrationId && !!currentWorkspaceId
  });

  const integrationName = integrationData?.name || 'Integration';
  
  const { data: logs, isLoading, isFetching } = useQuery({
    queryKey: ['activation-logs', integrationId, currentPage, pageSize, sortField, sortDirection],
    queryFn: () => sasActivationsApi.getActivationLogs(Number(integrationId), currentPage, pageSize),
    enabled: !!integrationId
  });

  // Virtual scroller for performance
  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    const sorted = [...logs];
    sorted.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'username':
          aVal = a.username?.toLowerCase() || '';
          bVal = b.username?.toLowerCase() || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'duration':
          aVal = a.durationMs || 0;
          bVal = b.durationMs || 0;
          break;
        case 'retries':
          aVal = a.retryCount;
          bVal = b.retryCount;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [logs, sortField, sortDirection]);

  const rowVirtualizer = useVirtualizer({
    count: sortedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  const retryMutation = useMutation({
    mutationFn: (period?: string) => 
      sasActivationsApi.retryFailedActivations(Number(integrationId), period),
    onSuccess: (data) => {
      toast.success(`Retrying ${data.count} failed activations`);
      queryClient.invalidateQueries({ queryKey: ['activation-logs', integrationId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to retry activations: ${error.message}`);
    }
  });

  const handleRetry = () => {
    retryMutation.mutate(retryPeriod);
  };

  const handleRetryAll = () => {
    retryMutation.mutate(undefined);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleResize = (column: string, clientX: number, initialWidth: number) => {
    setResizing(column);
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - clientX;
      const newWidth = Math.max(80, initialWidth + delta);
      setColumnWidths(prev => ({ ...prev, [column]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Calculate total pages (assuming 50 records per page means there might be more)
  const hasMorePages = logs && logs.length >= pageSize;

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activation Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and manage activation attempts sent to SAS4 for {integrationName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="icon"
                disabled={retryMutation.isPending}
                title="Retry failed activations"
              >
                <RotateCcw className={`h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Retry Failed Activations</h4>
                  <p className="text-xs text-muted-foreground">
                    Retry activations that failed due to temporary errors
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={retryPeriod} onValueChange={setRetryPeriod}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Last 24 hours</SelectItem>
                      <SelectItem value="2d">Last 2 days</SelectItem>
                      <SelectItem value="3d">Last 3 days</SelectItem>
                      <SelectItem value="1w">Last week</SelectItem>
                      <SelectItem value="2w">Last 2 weeks</SelectItem>
                      <SelectItem value="1m">Last month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleRetry} 
                    disabled={retryMutation.isPending}
                    size="sm"
                  >
                    Retry
                  </Button>
                </div>
                <Button 
                  onClick={handleRetryAll} 
                  disabled={retryMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Retry All Failed
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['activation-logs', integrationId] })} 
            variant="outline" 
            size="icon"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoading ? (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    <TableHead className="h-12 px-4 w-[180px]"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="h-12 px-4 w-[160px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[100px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[300px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isLoading && (!logs || logs.length === 0) ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Clock className="h-16 w-16 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No activation logs found</p>
              <p className="text-sm">Activation attempts will appear here once users are activated</p>
            </div>
          ) : sortedLogs.length > 0 ? (
            <>
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
                  {/* Fixed Header */}
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow className="hover:bg-muted">
                      <TableHead 
                        className="h-12 px-4 cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.timestamp}px` }}
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center">
                          Timestamp
                          {getSortIcon('createdAt')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('timestamp', e.clientX, columnWidths.timestamp);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.user}px` }}
                        onClick={() => handleSort('username')}
                      >
                        <div className="flex items-center">
                          User
                          {getSortIcon('username')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('user', e.clientX, columnWidths.user);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.status}px` }}
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center">
                          Status
                          {getSortIcon('status')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('status', e.clientX, columnWidths.status);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.duration}px` }}
                        onClick={() => handleSort('duration')}
                      >
                        <div className="flex items-center">
                          Duration
                          {getSortIcon('duration')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('duration', e.clientX, columnWidths.duration);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.retries}px` }}
                        onClick={() => handleSort('retries')}
                      >
                        <div className="flex items-center justify-center">
                          Retries
                          {getSortIcon('retries')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('retries', e.clientX, columnWidths.retries);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 relative"
                        style={{ width: `${columnWidths.error}px` }}
                      >
                        Error
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('error', e.clientX, columnWidths.error);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 relative"
                        style={{ width: `${columnWidths.nextRetry}px` }}
                      >
                        Next Retry
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('nextRetry', e.clientX, columnWidths.nextRetry);
                          }}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  
                  {/* Scrollable Body */}
                  <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const log = sortedLogs[virtualRow.index];
                      const config = statusConfig[log.status];
                      const StatusIcon = config.icon;
                      
                      return (
                        <TableRow 
                          key={log.id}
                          className="border-b hover:bg-muted/50 transition-colors"
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'table',
                            tableLayout: 'fixed',
                            backgroundColor: virtualRow.index % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.3)',
                          }}
                        >
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.timestamp}px` }}>
                            <div className="font-medium text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDistance(new Date(log.createdAt), new Date(), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.user}px` }}>
                            <div className="font-medium text-sm">{log.username}</div>
                            <div className="text-xs text-muted-foreground mt-1">ID: {log.userId}</div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.status}px` }}>
                            <Badge className={`${config.className} font-medium`}>
                              <StatusIcon className="h-3 w-3 mr-1.5" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.duration}px` }}>
                            {log.durationMs > 0 ? (
                              <>
                                <div className="font-medium text-sm">{formatDuration(log.durationMs)}</div>
                                {log.responseStatusCode && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    HTTP {log.responseStatusCode}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle text-center" style={{ width: `${columnWidths.retries}px` }}>
                            <div className="inline-flex items-center gap-1">
                              <span className="font-medium text-sm">{log.retryCount}</span>
                              <span className="text-muted-foreground text-xs">/</span>
                              <span className="text-muted-foreground text-sm">{log.maxRetries}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.error}px` }}>
                            {log.errorMessage ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-left w-full hover:underline">
                                    <span className="text-sm text-destructive truncate block font-medium">
                                      {log.errorMessage}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 p-4" align="start">
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h4 className="font-semibold text-sm mb-1">Error Details</h4>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                          {log.errorMessage}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 align-middle" style={{ width: `${columnWidths.nextRetry}px` }}>
                            {log.nextRetryAt ? (
                              <>
                                <div className="text-sm font-medium">
                                  {formatDistance(new Date(log.nextRetryAt), new Date(), { addSuffix: true })}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(log.nextRetryAt).toLocaleTimeString()}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                    <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="h-8 w-[70px] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="text-sm text-muted-foreground font-medium">
                    Showing {((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + sortedLogs.length} records
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="default"
                    size="icon"
                    className="h-8 w-8 p-0 text-sm font-medium"
                  >
                    {currentPage}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasMorePages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
