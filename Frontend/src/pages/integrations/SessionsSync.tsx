import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as signalR from '@microsoft/signalr';
import { appConfig } from '@/config/app.config';
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
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { sasRadiusApi } from '@/api/sasRadiusApi';
import { sessionSyncApi, type SessionSyncLog } from '@/api/sessionSyncApi';
import { tablePreferenceApi } from '@/api/tablePreferenceApi';
import { toast } from 'sonner';
import { 
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Play,
  Settings,
  Activity
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type SessionSyncLogType = SessionSyncLog & {
  status: 'success' | 'partial' | 'failed';
};

const mapStatusToString = (status: number): 'success' | 'partial' | 'failed' => {
  if (status === 5) return 'success'; // Completed
  if (status === 6) return 'failed'; // Failed
  return 'partial'; // Other statuses
};

export default function SessionsSync() {
  const { integrationId } = useParams<{ integrationId: string }>();
  const navigate = useNavigate();
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const hubConnectionRef = useRef<signalR.HubConnection | null>(null);

  // State
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(500);

  // Column widths
  const DEFAULT_COLUMN_WIDTHS = {
    timestamp: 180,
    status: 140,
    totalUsers: 120,
    syncedUsers: 120,
    failedUsers: 120,
    duration: 120,
    error: 300,
  };

  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load table preferences on mount
  useEffect(() => {
    if (!integrationId) return;
    
    const loadPreferences = async () => {
      try {
        const tableName = `sessions-sync-${integrationId}`;
        const preferences = await tablePreferenceApi.getPreference(tableName);
        if (preferences) {
          if (preferences.columnWidths) {
            setColumnWidths({ ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(preferences.columnWidths) });
          }
          if (preferences.sortField) {
            setSortField(preferences.sortField);
            setSortDirection((preferences.sortDirection as 'asc' | 'desc') || 'desc');
          }
        }
      } catch (error) {
        console.log('No saved preferences found', error);
      } finally {
        setPreferencesLoaded(true);
      }
    };

    setPreferencesLoaded(false);
    loadPreferences();
  }, [integrationId]);

  // Auto-save preferences when they change
  useEffect(() => {
    if (!preferencesLoaded || !integrationId) return;

    const savePreferences = async () => {
      try {
        const tableName = `sessions-sync-${integrationId}`;
        await tablePreferenceApi.savePreference({
          tableName,
          columnWidths: JSON.stringify(columnWidths),
          sortField,
          sortDirection,
        });
      } catch (error) {
        console.error('Failed to save preferences:', error);
      }
    };

    const debounceTimer = setTimeout(savePreferences, 500);
    return () => clearTimeout(debounceTimer);
  }, [columnWidths, sortField, sortDirection, preferencesLoaded, integrationId]);

  // Fetch integration name
  const { data: integration } = useQuery({
    queryKey: ['sas-radius-integration', currentWorkspaceId, integrationId],
    queryFn: () => sasRadiusApi.getById(Number(currentWorkspaceId), Number(integrationId)),
    enabled: !!currentWorkspaceId && !!integrationId,
  });

  const integrationName = integration?.name || 'Unknown Integration';

  // Load records per page from integration
  useEffect(() => {
    if (integration?.sessionSyncRecordsPerPage) {
      setRecordsPerPage(integration.sessionSyncRecordsPerPage);
    }
  }, [integration]);

  // Fetch session sync logs
  const { data: logsData, isLoading, isFetching } = useQuery({
    queryKey: ['session-sync-logs', currentWorkspaceId, integrationId],
    queryFn: () => sessionSyncApi.getLogs(Number(currentWorkspaceId), Number(integrationId)),
    enabled: !!currentWorkspaceId && !!integrationId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const logs = useMemo(() => logsData || [], [logsData]);
  const totalLogs = logsData?.length || 0;

  // Mutation to save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspaceId || !integrationId) throw new Error('Missing workspace or integration ID');
      const updated = {
        ...integration!,
        sessionSyncRecordsPerPage: recordsPerPage,
      };
      return sasRadiusApi.update(Number(currentWorkspaceId), Number(integrationId), updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sas-radius-integration', currentWorkspaceId, integrationId] });
      toast.success('Settings saved successfully');
      setIsSettingsOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save settings');
    },
  });

  // Mutation to start sync
  const startSyncMutation = useMutation({
    mutationFn: () => sessionSyncApi.startSync(Number(currentWorkspaceId), Number(integrationId)),
    onSuccess: (data) => {
      setActiveSyncId(data.syncId);
      setIsSyncing(true);
      toast.success('Session sync started - Synchronizing online users to SAS4...');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start sync');
    },
  });

  // Apply search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchInput]);

  // SignalR connection for real-time updates
  useEffect(() => {
    if (!currentWorkspaceId) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${appConfig.api.baseUrl}/hubs/sassync`)
      .withAutomaticReconnect()
      .build();

    connection.on('SessionSyncProgress', (message: any) => {
      if (message.IntegrationId === Number(integrationId)) {
        // Update UI based on progress
        if (message.Status === 3 || message.Status === 4 || message.Status === 5) {
          // Completed, Failed, or Cancelled
          setIsSyncing(false);
          setActiveSyncId(null);
          
          // Refetch logs to show new entries
          queryClient.invalidateQueries({ 
            queryKey: ['session-sync-logs', currentWorkspaceId, integrationId] 
          });

          // Show completion toast
          if (message.Status === 3) {
            toast.success(`Session sync completed - Synced ${message.SuccessCount || 0} users successfully`);
          } else if (message.Status === 4) {
            toast.error(message.CurrentMessage || 'Session sync failed');
          }
        }
      }
    });

    connection.start()
      .then(() => {
        console.log('SignalR connected for session sync updates');
        hubConnectionRef.current = connection;
      })
      .catch((err) => console.error('SignalR connection error:', err));

    return () => {
      connection.stop();
    };
  }, [currentWorkspaceId, integrationId, queryClient]);

  // Filter and sort logs
  const sortedLogs = useMemo(() => {
    let filtered = logs.filter((log: SessionSyncLog) => {
      const matchesSearch = searchQuery === '' || 
        log.errorMessage?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort
    filtered.sort((a: SessionSyncLog, b: SessionSyncLog) => {
      let aVal: any = a[sortField as keyof SessionSyncLog];
      let bVal: any = b[sortField as keyof SessionSyncLog];

      if (sortField === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [logs, searchQuery, statusFilter, sortField, sortDirection]);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: sortedLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleResize = (column: string, startX: number, startWidth: number) => {
    setResizing(column);

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + diff);
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

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SAS Integration Sessions Sync</h1>
          <p className="text-sm text-muted-foreground">
            View synchronization history for online users from RADIUS to SAS4 for {integrationName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search error messages..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => startSyncMutation.mutate()} 
            variant="outline" 
            size="icon"
            title="Start Sync"
            disabled={isSyncing || startSyncMutation.isPending}
          >
            {isSyncing || startSyncMutation.isPending ? (
              <Activity className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button 
            onClick={() => setIsSettingsOpen(true)} 
            variant="outline" 
            size="icon"
            title="Sync Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['session-sync-logs', currentWorkspaceId, integrationId] })} 
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
                    <TableHead className="h-12 px-4 w-[140px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[120px]"><Skeleton className="h-4 w-16" /></TableHead>
                    <TableHead className="h-12 px-4 w-[300px]"><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="h-12 px-4"><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isLoading && (!logs || logs.length === 0) ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Clock className="h-16 w-16 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No sync logs found</p>
              <p className="text-sm">Session sync logs will appear here once the sync job runs</p>
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
                        onClick={() => handleSort('timestamp')}
                      >
                        <div className="flex items-center">
                          Timestamp
                          {getSortIcon('timestamp')}
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
                        className="h-12 px-4 text-right cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.totalUsers}px` }}
                        onClick={() => handleSort('totalUsers')}
                      >
                        <div className="flex items-center justify-end">
                          Total Users
                          {getSortIcon('totalUsers')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('totalUsers', e.clientX, columnWidths.totalUsers);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 text-right cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.syncedUsers}px` }}
                        onClick={() => handleSort('syncedUsers')}
                      >
                        <div className="flex items-center justify-end">
                          Synced
                          {getSortIcon('syncedUsers')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('syncedUsers', e.clientX, columnWidths.syncedUsers);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 text-right cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.failedUsers}px` }}
                        onClick={() => handleSort('failedUsers')}
                      >
                        <div className="flex items-center justify-end">
                          Failed
                          {getSortIcon('failedUsers')}
                        </div>
                        <div 
                          className="absolute top-0 right-0 w-2 h-full cursor-col-resize border-r-2 border-dotted border-gray-300 hover:border-blue-500 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => { 
                            e.preventDefault();
                            e.stopPropagation();
                            handleResize('failedUsers', e.clientX, columnWidths.failedUsers);
                          }}
                        />
                      </TableHead>
                      <TableHead 
                        className="h-12 px-4 text-right cursor-pointer select-none relative hover:bg-muted-foreground/10 transition-colors"
                        style={{ width: `${columnWidths.duration}px` }}
                        onClick={() => handleSort('duration')}
                      >
                        <div className="flex items-center justify-end">
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
                        className="h-12 px-4"
                        style={{ width: `${columnWidths.error}px` }}
                      >
                        Error Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      position: 'relative',
                    }}
                  >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const log = sortedLogs[virtualRow.index] as SessionSyncLog;
                      return (
                        <TableRow
                          key={log.id}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <TableCell className="h-12 px-4 font-mono text-sm" style={{ width: `${columnWidths.timestamp}px` }}>
                            {format(parseISO(log.timestamp), 'MMM dd, HH:mm:ss')}
                          </TableCell>
                          <TableCell className="h-12 px-4" style={{ width: `${columnWidths.status}px` }}>
                            {getStatusBadge(log.status)}
                          </TableCell>
                          <TableCell className="h-12 px-4 text-right" style={{ width: `${columnWidths.totalUsers}px` }}>
                            {log.totalUsers}
                          </TableCell>
                          <TableCell className="h-12 px-4 text-right text-green-600" style={{ width: `${columnWidths.syncedUsers}px` }}>
                            {log.syncedUsers}
                          </TableCell>
                          <TableCell className="h-12 px-4 text-right text-red-600" style={{ width: `${columnWidths.failedUsers}px` }}>
                            {log.failedUsers}
                          </TableCell>
                          <TableCell className="h-12 px-4 text-right" style={{ width: `${columnWidths.duration}px` }}>
                            {formatDuration(log.duration)}
                          </TableCell>
                          <TableCell className="h-12 px-4 text-sm text-muted-foreground truncate" style={{ width: `${columnWidths.error}px` }} title={log.errorMessage}>
                            {log.errorMessage || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Clock className="h-16 w-16 mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No results found</p>
              <p className="text-sm">Try adjusting your filters to see more results</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Sync Settings</DialogTitle>
            <DialogDescription>
              Configure how online users are synchronized from RADIUS to SAS4
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recordsPerPage">Records Per Page</Label>
              <Input
                id="recordsPerPage"
                type="number"
                min="1"
                max="10000"
                value={recordsPerPage}
                onChange={(e) => setRecordsPerPage(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="500"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of online users to fetch per sync operation (default: 500)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
