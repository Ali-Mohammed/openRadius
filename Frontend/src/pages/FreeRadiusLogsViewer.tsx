import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKeycloak } from '../contexts/KeycloakContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import * as signalR from '@microsoft/signalr';
import {
  RefreshCw,
  Download,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  Bug,
  Activity,
} from 'lucide-react';
import type {
  LogFilter,
  LogsResponse,
  LogStatistics,
  RadwtmpEntry,
  LogType,
  FreeRadiusLogEntry,
} from '../types/freeradiusLogs';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function FreeRadiusLogsViewer() {
  const { keycloak } = useKeycloak();
  const queryClient = useQueryClient();

  // State
  const [filter, setFilter] = useState<LogFilter>({
    logType: 'radius',
    lines: 100,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Fetch log types
  const { data: logTypesData } = useQuery<{ types: LogType[] }>({
    queryKey: ['logTypes'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/freeradiuslogs/types`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch log types');
      return response.json();
    },
    enabled: !!keycloak.token,
  });

  // Fetch logs
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery<LogsResponse>({
    queryKey: ['freeradiusLogs', filter],
    queryFn: async () => {
      const filterToSend = {
        ...filter,
        searchTerm: searchTerm || undefined,
        level: selectedLevel !== 'all' ? selectedLevel : undefined,
      };

      const response = await fetch(`${API_BASE}/api/freeradiuslogs/fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify(filterToSend),
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.json();
    },
    enabled: !!keycloak.token,
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch statistics
  const { data: statsData } = useQuery<LogStatistics>({
    queryKey: ['logStatistics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/freeradiuslogs/statistics`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch statistics');
      return response.json();
    },
    enabled: !!keycloak.token,
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch radwtmp entries
  const { data: radwtmpData } = useQuery<RadwtmpEntry[]>({
    queryKey: ['radwtmp'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/freeradiuslogs/radwtmp?limit=50`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch radwtmp');
      return response.json();
    },
    enabled: !!keycloak.token && filter.logType === 'radwtmp',
  });

  // Check FreeRADIUS status
  const { data: statusData } = useQuery<{ isRunning: boolean; containerName: string }>({
    queryKey: ['freeradiusStatus'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/freeradiuslogs/status`, {
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to check status');
      return response.json();
    },
    enabled: !!keycloak.token,
    refetchInterval: 30000,
  });

  // SignalR connection for real-time logs
  useEffect(() => {
    if (!keycloak.token) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/logs`, {
        accessTokenFactory: () => keycloak.token || '',
      })
      .withAutomaticReconnect()
      .build();

    newConnection.on('LogsUpdate', (logs: LogsResponse) => {
      queryClient.setQueryData(['freeradiusLogs', filter], logs);
    });

    newConnection.on('LogError', (error: string) => {
      toast.error('Log streaming error: ' + error);
      setIsStreaming(false);
    });

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, [keycloak.token, queryClient, filter]);

  const startStreaming = async () => {
    if (!connection) return;

    try {
      await connection.start();
      await connection.invoke('StartLogStreaming', filter);
      setIsStreaming(true);
      toast.success('Real-time log streaming started');
    } catch (error) {
      console.error('Failed to start streaming:', error);
      toast.error('Failed to start log streaming');
    }
  };

  const stopStreaming = async () => {
    if (!connection) return;

    try {
      await connection.invoke('StopLogStreaming');
      await connection.stop();
      setIsStreaming(false);
      toast.success('Log streaming stopped');
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  };

  // Export logs
  const exportLogs = () => {
    if (!logsData?.entries.length) {
      toast.error('No logs to export');
      return;
    }

    const content = logsData.entries.map((entry) => entry.rawLine).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freeradius-${filter.logType}-${new Date().toISOString()}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported successfully');
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'auth':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'auth':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getAuthResultBadge = (result?: string) => {
    if (!result) return null;

    switch (result.toLowerCase()) {
      case 'accept':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accept
          </Badge>
        );
      case 'reject':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </Badge>
        );
      case 'challenge':
        return (
          <Badge variant="default" className="bg-yellow-500">
            Challenge
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">FreeRADIUS Logs</h1>
          <p className="text-muted-foreground">
            View and monitor FreeRADIUS authentication and accounting logs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusData && (
            <Badge variant={statusData.isRunning ? 'default' : 'destructive'}>
              {statusData.isRunning ? '● Running' : '● Stopped'}
            </Badge>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {statsData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Authentications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalAuthentications}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Successful
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsData.successfulAuths}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statsData.failedAuths}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Accounting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statsData.totalAccounting}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={filter.logType} onValueChange={(value) => setFilter({ ...filter, logType: value })}>
        <TabsList>
          <TabsTrigger value="radius">General Logs</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="radwtmp">Login History</TabsTrigger>
        </TabsList>

        <TabsContent value="radius" className="space-y-4">
          <LogViewerContent
            logsData={logsData}
            isLoadingLogs={isLoadingLogs}
            filter={filter}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            isStreaming={isStreaming}
            refetchLogs={refetchLogs}
            exportLogs={exportLogs}
            startStreaming={startStreaming}
            stopStreaming={stopStreaming}
            getLevelIcon={getLevelIcon}
            getLevelBadgeVariant={getLevelBadgeVariant}
            getAuthResultBadge={getAuthResultBadge}
          />
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <LogViewerContent
            logsData={logsData}
            isLoadingLogs={isLoadingLogs}
            filter={filter}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedLevel={selectedLevel}
            setSelectedLevel={setSelectedLevel}
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            isStreaming={isStreaming}
            refetchLogs={refetchLogs}
            exportLogs={exportLogs}
            startStreaming={startStreaming}
            stopStreaming={stopStreaming}
            getLevelIcon={getLevelIcon}
            getLevelBadgeVariant={getLevelBadgeVariant}
            getAuthResultBadge={getAuthResultBadge}
          />
        </TabsContent>

        <TabsContent value="radwtmp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Login History</CardTitle>
              <CardDescription>Recent user login and logout events from radwtmp</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>NAS IP</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead>Logout Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {radwtmpData?.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{entry.username}</TableCell>
                      <TableCell>{entry.nasIpAddress}</TableCell>
                      <TableCell>{new Date(entry.loginTime).toLocaleString()}</TableCell>
                      <TableCell>
                        {entry.logoutTime ? new Date(entry.logoutTime).toLocaleString() : '-'}
                      </TableCell>
                      <TableCell>{entry.duration}</TableCell>
                      <TableCell>
                        <Badge variant={entry.isOnline ? 'default' : 'secondary'}>
                          {entry.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface LogViewerContentProps {
  logsData?: LogsResponse;
  isLoadingLogs: boolean;
  filter: LogFilter;
  setFilter: (filter: LogFilter) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedLevel: string;
  setSelectedLevel: (level: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (refresh: boolean) => void;
  isStreaming: boolean;
  refetchLogs: () => void;
  exportLogs: () => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  getLevelIcon: (level: string) => JSX.Element;
  getLevelBadgeVariant: (level: string) => any;
  getAuthResultBadge: (result?: string) => JSX.Element | null;
}

function LogViewerContent({
  logsData,
  isLoadingLogs,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  selectedLevel,
  setSelectedLevel,
  autoRefresh,
  setAutoRefresh,
  isStreaming,
  refetchLogs,
  exportLogs,
  startStreaming,
  stopStreaming,
  getLevelIcon,
  getLevelBadgeVariant,
  getAuthResultBadge,
}: LogViewerContentProps) {
  return (
    <>
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Number of Lines</Label>
              <Input
                type="number"
                value={filter.lines}
                onChange={(e) => setFilter({ ...filter, lines: parseInt(e.target.value) || 100 })}
                min={10}
                max={10000}
              />
            </div>

            <div>
              <Label>Log Level</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="Error">Error</SelectItem>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Info">Info</SelectItem>
                  <SelectItem value="Auth">Auth</SelectItem>
                  <SelectItem value="Debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={() => refetchLogs()} disabled={isLoadingLogs}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoRefresh" className="cursor-pointer">
                Auto-refresh (5s)
              </Label>
            </div>

            {!isStreaming ? (
              <Button variant="outline" onClick={startStreaming}>
                <Activity className="h-4 w-4 mr-2" />
                Start Real-time
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopStreaming}>
                Stop Streaming
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs</CardTitle>
              <CardDescription>
                {logsData?.totalLines || 0} entries • Last updated:{' '}
                {new Date().toLocaleTimeString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingLogs ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[80px]">Level</TableHead>
                    <TableHead className="w-[150px]">Username</TableHead>
                    <TableHead className="w-[120px]">Result</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData?.entries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs font-mono">{entry.timestamp}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getLevelIcon(entry.level)}
                          <Badge variant={getLevelBadgeVariant(entry.level)} className="text-xs">
                            {entry.level}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.username || '-'}
                      </TableCell>
                      <TableCell>{getAuthResultBadge(entry.authResult)}</TableCell>
                      <TableCell className="text-sm">
                        <div className="max-w-2xl truncate" title={entry.message}>
                          {entry.message}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
