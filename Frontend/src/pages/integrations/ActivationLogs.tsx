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
    estimateSize: () => 48,
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
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activation Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and manage activation attempts sent to SAS4 for {integrationName}
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Retry Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retry Failed Activations</CardTitle>
          <CardDescription>
            Retry activations that failed due to temporary errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm font-medium">Retry failed from:</span>
              <Select value={retryPeriod} onValueChange={setRetryPeriod}>
                <SelectTrigger className="w-45">
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
                {retryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Selected Period
                  </>
                )}
              </Button>
            </div>
            <Button 
              onClick={handleRetryAll} 
              disabled={retryMutation.isPending}
              variant="outline"
              size="sm"
            >
              Retry All Failed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activation History</CardTitle>
              <CardDescription>
                Complete history of activation attempts
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs && logs.length > 0 ? (
            <>
              <div className="border-b">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-12 px-4">Timestamp</TableHead>
                      <TableHead className="h-12 px-4">User</TableHead>
                      <TableHead className="h-12 px-4">Status</TableHead>
                      <TableHead className="h-12 px-4">Duration</TableHead>
                      <TableHead className="h-12 px-4 text-center">Retries</TableHead>
                      <TableHead className="h-12 px-4">Error</TableHead>
                      <TableHead className="h-12 px-4">Next Retry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const config = statusConfig[log.status];
                      const StatusIcon = config.icon;
                      
                      return (
                        <TableRow key={log.id} className="h-12">
                          <TableCell className="px-4">
                            <div className="text-sm font-medium">
                              {new Date(log.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistance(new Date(log.createdAt), new Date(), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="text-sm font-medium">{log.username}</div>
                            <div className="text-xs text-muted-foreground">ID: {log.userId}</div>
                          </TableCell>
                          <TableCell className="px-4">
                            <Badge className={config.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4">
                            {log.durationMs > 0 ? (
                              <>
                                <div className="text-sm">{formatDuration(log.durationMs)}</div>
                                {log.responseStatusCode && (
                                  <div className="text-xs text-muted-foreground">
                                    HTTP {log.responseStatusCode}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 text-center">
                            <span className="text-sm">{log.retryCount} / {log.maxRetries}</span>
                          </TableCell>
                          <TableCell className="px-4 max-w-xs">
                            {log.errorMessage ? (
                              <span className="text-sm text-destructive truncate block" title={log.errorMessage}>
                                {log.errorMessage}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4">
                            {log.nextRetryAt ? (
                              <span className="text-sm">
                                {formatDistance(new Date(log.nextRetryAt), new Date(), { addSuffix: true })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
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
                    Showing {((currentPage - 1) * pageSize) + 1} to {((currentPage - 1) * pageSize) + logs.length} records
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
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Clock className="h-16 w-16 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No activation logs found</p>
              <p className="text-sm">Activation attempts will appear here once users are activated</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
