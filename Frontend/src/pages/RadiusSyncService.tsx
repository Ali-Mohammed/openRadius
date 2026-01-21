import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  Server, 
  Clock, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Signal,
  ChevronRight,
  Check,
  X,
  Zap,
  Cpu,
  MemoryStick,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceInfo {
  serviceName: string;
  displayName?: string;
  version: string;
  connectionId: string;
  status: 'Online' | 'Offline' | 'Degraded' | 'Maintenance';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  connectedAt: string;
  lastHeartbeat: string;
  ipAddress?: string;
  userAgent?: string;
  currentActivity?: string;
  activityProgress?: number;
  healthReport?: {
    isHealthy: boolean;
    cpuUsage: number;
    memoryUsageMb: number;
    activeConnections: number;
    pendingTasks: number;
    customMetrics?: Record<string, unknown>;
  };
  metadata?: Record<string, string>;
  // New ping metrics
  lastPing?: number;
  avgPing?: number;
  pingHistory?: number[];
}

interface ServiceLog {
  id: string;
  serviceName: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  data?: unknown;
  timestamp: string;
}

interface PendingPing {
  serviceName: string;
  pingId: string;
  sentAt: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RadiusSyncServicePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [dashboardPing, setDashboardPing] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [serviceToApprove, setServiceToApprove] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState('');
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize SignalR connection
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/microservices`)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connectionRef.current = newConnection;
    setConnection(newConnection);

    return () => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.invoke('LeaveDashboard').catch(() => {});
        newConnection.stop();
      }
    };
  }, []);

  // Measure dashboard ping
  const measureDashboardPing = useCallback(async () => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    
    const start = Date.now();
    try {
      await conn.invoke('GetConnectedServices');
      const latency = Date.now() - start;
      setDashboardPing(latency);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Ping error:', err);
      setDashboardPing(null);
    }
  }, []);

  // Handle connection state changes
  useEffect(() => {
    if (!connection) return;

    const startConnection = async () => {
      try {
        await connection.start();
        setConnectionState('Connected');
        setLastUpdate(new Date());
        
        // Join the dashboard group to receive service updates
        await connection.invoke('JoinDashboard');
        
        // Measure initial ping
        setTimeout(() => measureDashboardPing(), 500);
      } catch (err) {
        console.error('SignalR Connection Error:', err);
        setConnectionState('Error');
        setTimeout(startConnection, 5000);
      }
    };

    connection.onclose(() => {
      setConnectionState('Disconnected');
      setDashboardPing(null);
    });

    connection.onreconnecting(() => {
      setConnectionState('Reconnecting');
    });

    connection.onreconnected(() => {
      setConnectionState('Connected');
      setLastUpdate(new Date());
      connection.invoke('JoinDashboard').catch(console.error);
      setTimeout(() => measureDashboardPing(), 500);
    });

    // Handle initial state
    connection.on('InitialState', (data: { services: ServiceInfo[] } | ServiceInfo[]) => {
      const servicesList = Array.isArray(data) ? data : data.services;
      setServices(servicesList);
      setLastUpdate(new Date());
    });

    // Handle service connected
    connection.on('ServiceConnected', (service: ServiceInfo) => {
      setServices(prev => {
        const existing = prev.findIndex(s => s.serviceName === service.serviceName);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = service;
          return updated;
        }
        return [...prev, service];
      });
      setLastUpdate(new Date());
      addLog({
        serviceName: service.serviceName,
        level: 'info',
        message: `Service connected: ${service.serviceName} v${service.version}`,
        timestamp: new Date().toISOString()
      });
    });

    // Handle service disconnected
    connection.on('ServiceDisconnected', (data: { serviceName: string; disconnectedAt: string }) => {
      setServices(prev => prev.filter(s => s.serviceName !== data.serviceName));
      setLastUpdate(new Date());
      addLog({
        serviceName: data.serviceName,
        level: 'warning',
        message: `Service disconnected: ${data.serviceName}`,
        timestamp: data.disconnectedAt
      });
    });

    // Handle heartbeat updates
    connection.on('ServiceHeartbeat', (data: { 
      serviceName: string; 
      status: string; 
      lastHeartbeat: string;
      healthReport: ServiceInfo['healthReport'];
    }) => {
      setServices(prev => prev.map(s => 
        s.serviceName === data.serviceName 
          ? { ...s, status: data.status as ServiceInfo['status'], lastHeartbeat: data.lastHeartbeat, healthReport: data.healthReport }
          : s
      ));
      setLastUpdate(new Date());
    });

    // Handle activity updates
    connection.on('ServiceActivity', (data: { 
      serviceName: string; 
      activity: string; 
      progress?: number;
      timestamp: string;
    }) => {
      setServices(prev => prev.map(s => 
        s.serviceName === data.serviceName 
          ? { ...s, currentActivity: data.activity, activityProgress: data.progress }
          : s
      ));
      setLastUpdate(new Date());
    });

    // Handle service logs
    connection.on('ServiceLog', (log: Omit<ServiceLog, 'id'>) => {
      addLog(log);
    });

    // Handle service approval
    connection.on('ServiceApproved', (service: ServiceInfo) => {
      setServices(prev => prev.map(s =>
        s.serviceName === service.serviceName ? service : s
      ));
      setLastUpdate(new Date());
    });

    // Handle service rejection
    connection.on('ServiceRejected', (serviceName: string) => {
      setServices(prev => prev.filter(s => s.serviceName !== serviceName));
      setLastUpdate(new Date());
    });

    startConnection();
  }, [connection]);

  const addLog = useCallback((log: Omit<ServiceLog, 'id'>) => {
    const newLog: ServiceLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
  }, []);

  // Measure dashboard ping every 5 seconds
  useEffect(() => {
    if (connectionState !== 'Connected') return;
    
    // Initial ping already done in connection setup
    const interval = setInterval(() => {
      measureDashboardPing();
    }, 5000); // Every 5 seconds for more responsive updates
    
    return () => clearInterval(interval);
  }, [connectionState, measureDashboardPing]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Online': return 'bg-green-500';
      case 'Degraded': return 'bg-yellow-500';
      case 'Maintenance': return 'bg-blue-500';
      default: return 'bg-red-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Online': return <Badge className="bg-green-500">{status}</Badge>;
      case 'Degraded': return <Badge className="bg-yellow-500">{status}</Badge>;
      case 'Maintenance': return <Badge className="bg-blue-500">{status}</Badge>;
      default: return <Badge variant="destructive">{status}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatUptime = (connectedAt: string) => {
    const diff = Date.now() - new Date(connectedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = currentTime.getTime() - new Date(timestamp).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds}s ago`;
    return `${seconds}s ago`;
  };

  const openApprovalDialog = (svcName: string) => {
    setServiceToApprove(svcName);
    setServiceName('');
    setApprovalDialogOpen(true);
  };

  const approveService = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceToApprove || !serviceName.trim()) return;
    try {
      await connection.invoke('ApproveService', serviceToApprove, serviceName.trim());
      setApprovalDialogOpen(false);
      setServiceToApprove(null);
      setServiceName('');
    } catch (err) {
      console.error('Failed to approve service:', err);
    }
  };

  const rejectService = async (serviceName: string) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    try {
      await connection.invoke('RejectService', serviceName);
    } catch (err) {
      console.error('Failed to reject service:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('radiusSyncService.title', 'Radius Sync Service')}
          </h1>
          <p className="text-muted-foreground">
            {t('radiusSyncService.subtitle', 'Monitor and manage connected microservices')}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Real-time clock */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-muted/50 to-muted/30 backdrop-blur-sm border border-border/50 shadow-sm text-sm">
            <Clock className="h-4 w-4 text-primary animate-pulse" />
            <span className="font-mono font-semibold">{currentTime.toLocaleTimeString()}</span>
          </div>
          
          {/* Connection Status */}
          <Badge 
            variant={connectionState === 'Connected' ? 'default' : 'secondary'} 
            className={cn(
              "gap-2 px-4 py-2 transition-all duration-300 shadow-sm",
              connectionState === 'Connected' && "bg-green-500 hover:bg-green-600 animate-pulse"
            )}
          >
            {connectionState === 'Connected' ? (
              <Wifi className="h-4 w-4" />
            ) : connectionState === 'Reconnecting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span className="font-medium">{connectionState}</span>
          </Badge>

          {/* Last Update */}
          {lastUpdate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-2 px-3 py-2 cursor-help">
                    <RefreshCw className="h-3 w-3 text-green-500" />
                    <span className="text-xs">{getTimeAgo(lastUpdate.toISOString())}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Last updated: {lastUpdate.toLocaleTimeString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Online Services</p>
                <p className="text-2xl font-bold text-green-600">
                  {services.filter(s => s.approvalStatus === 'Approved' && s.status === 'Online').length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-orange-600">
                  {services.filter(s => s.approvalStatus === 'Pending').length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-orange-600 animate-pulse" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Degraded</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {services.filter(s => s.status === 'Degraded').length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                <p className="text-2xl font-bold text-blue-600">
                  {services.length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <Server className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services List */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b bg-gradient-to-r from-muted/30 to-background">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Server className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div>{t('radiusSyncService.connectedServices', 'Connected Services')}</div>
                  <CardDescription className="text-xs mt-1">
                    {services.length} service{services.length !== 1 ? 's' : ''} connected • Real-time monitoring
                  </CardDescription>
                </div>
              </CardTitle>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <Activity className="h-3 w-3 text-green-600" />
                <span className="font-medium">{services.filter(s => s.approvalStatus === 'Approved' && s.status === 'Online').length} Online</span>
              </Badge>
              {services.filter(s => s.approvalStatus === 'Pending').length > 0 && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <AlertCircle className="h-3 w-3 text-orange-600 animate-pulse" />
                  <span className="font-medium text-orange-600">{services.filter(s => s.approvalStatus === 'Pending').length} Pending</span>
                </Badge>
              )}
              {services.filter(s => s.status === 'Degraded').length > 0 && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="h-3 w-3 text-yellow-600" />
                  <span className="font-medium text-yellow-600">{services.filter(s => s.status === 'Degraded').length} Degraded</span>
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Server className="h-10 w-10 opacity-50" />
              </div>
              <p className="text-lg font-medium">{t('radiusSyncService.noServices', 'No services connected')}</p>
              <p className="text-sm mt-2">Start a microservice to see it here</p>
              <div className="mt-6 p-4 rounded-lg bg-muted/50 text-left text-sm max-w-md border border-border/50">
                <p className="font-medium mb-2 text-foreground">Quick Start:</p>
                <code className="block bg-background/80 p-2 rounded border border-border/50 mb-1">cd microservices/RadiusSyncService</code>
                <code className="block bg-background/80 p-2 rounded border border-border/50">dotnet run</code>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Services Section */}
              {services.filter(s => s.approvalStatus === 'Pending').length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-300"></div>
                    <h3 className="text-sm font-bold text-orange-600 flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30">
                      <AlertCircle className="h-4 w-4 animate-pulse" />
                      Pending Approval ({services.filter(s => s.approvalStatus === 'Pending').length})
                    </h3>
                    <div className="h-1 flex-1 rounded-full bg-gradient-to-l from-orange-500 to-orange-300"></div>
                  </div>
                  {services.filter(s => s.approvalStatus === 'Pending').map((service) => (
                    <div
                      key={service.serviceName}
                      className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/80 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 p-5 shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        {/* Animated Status Indicator */}
                        <div className="relative">
                          <div className="h-4 w-4 rounded-full bg-orange-500 animate-pulse" />
                          <div className="absolute inset-0 h-4 w-4 rounded-full bg-orange-500 animate-ping opacity-75" />
                        </div>
                        
                        {/* Service Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <h3 className="font-bold text-xl text-orange-900 dark:text-orange-100">{service.serviceName}</h3>
                            <Badge variant="outline" className="text-xs border-orange-300">v{service.version}</Badge>
                          </div>
                          <p className="text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Requested {getTimeAgo(service.connectedAt)}
                          </p>
                        </div>

                        {/* Approval Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              openApprovalDialog(service.serviceName);
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-sm hover:shadow-md transition-all duration-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              rejectService(service.serviceName);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>

                      {/* Connection Details */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-lg bg-white/70 dark:bg-black/30 border border-orange-200 dark:border-orange-800/50 backdrop-blur-sm">
                        {service.ipAddress && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">IP Address</p>
                            <p className="text-sm font-mono font-medium text-foreground">{service.ipAddress}</p>
                          </div>
                        )}
                        {service.metadata?.machineName && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Machine</p>
                            <p className="text-sm font-mono font-medium text-foreground">{service.metadata.machineName}</p>
                          </div>
                        )}
                        {service.metadata?.platform && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Platform</p>
                            <p className="text-sm font-mono font-medium text-foreground">{service.metadata.platform}</p>
                          </div>
                        )}
                        {service.metadata?.osVersion && (
                          <div className="space-y-1 md:col-span-2">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">OS Version</p>
                            <p className="text-sm font-mono font-medium text-foreground truncate" title={service.metadata.osVersion}>
                              {service.metadata.osVersion}
                            </p>
                          </div>
                        )}
                        {service.metadata?.dotnetVersion && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">.NET</p>
                            <p className="text-sm font-mono font-medium text-foreground">{service.metadata.dotnetVersion}</p>
                          </div>
                        )}
                        {service.metadata?.environment && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Environment</p>
                            <Badge variant="outline" className="text-xs font-medium">
                              {service.metadata.environment}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Approved Services Section */}
              {services.filter(s => s.approvalStatus === 'Approved').length > 0 && (
                <div className="space-y-3">
                  {services.filter(s => s.approvalStatus === 'Pending').length > 0 && (
                    <div className="flex items-center gap-2 mt-6">
                      <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-green-500 to-green-300"></div>
                      <h3 className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                        <CheckCircle2 className="h-4 w-4" />
                        Active Services ({services.filter(s => s.approvalStatus === 'Approved').length})
                      </h3>
                      <div className="h-1 flex-1 rounded-full bg-gradient-to-l from-green-500 to-green-300"></div>
                    </div>
                  )}
                  <div className="grid gap-3">
                    {services.filter(s => s.approvalStatus === 'Approved').map((service) => (
                      <div
                        key={service.serviceName}
                        className={cn(
                          "group rounded-xl border-2 p-5 cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl",
                          "bg-gradient-to-br from-background to-muted/20",
                          service.status === 'Online' 
                            ? "border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600" 
                            : service.status === 'Degraded'
                            ? "border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600"
                            : "border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600",
                          "hover:scale-[1.02] active:scale-[0.98]"
                        )}
                        onClick={() => navigate(`/microservices/radius-sync/${encodeURIComponent(service.serviceName)}`)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Animated Status Indicator */}
                          <div className="relative">
                            <div className={cn(
                              "h-4 w-4 rounded-full transition-all duration-300",
                              service.status === 'Online' && "bg-green-500 shadow-lg shadow-green-500/50",
                              service.status === 'Degraded' && "bg-yellow-500 shadow-lg shadow-yellow-500/50",
                              service.status === 'Offline' && "bg-red-500 shadow-lg shadow-red-500/50"
                            )} />
                            {service.status === 'Online' && (
                              <div className="absolute inset-0 h-4 w-4 rounded-full bg-green-500 animate-ping opacity-75" />
                            )}
                          </div>
                          
                          {/* Service Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <h3 className="font-bold text-xl">{service.displayName || service.serviceName}</h3>
                              <Badge variant="outline" className="text-xs">v{service.version}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                <span>Uptime: {formatUptime(service.connectedAt)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>Last heartbeat: {getTimeAgo(service.lastHeartbeat)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Health Metrics */}
                          {service.healthReport && (
                            <div className="flex items-center gap-4">
                              <div className="text-center px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-1 mb-1">
                                  <Cpu className="h-3 w-3 text-blue-600" />
                                  <p className="text-xs text-muted-foreground font-semibold">CPU</p>
                                </div>
                                <p className="text-sm font-bold text-blue-600">{service.healthReport.cpuUsage.toFixed(1)}%</p>
                              </div>
                              <div className="text-center px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center gap-1 mb-1">
                                  <MemoryStick className="h-3 w-3 text-purple-600" />
                                  <p className="text-xs text-muted-foreground font-semibold">Memory</p>
                                </div>
                                <p className="text-sm font-bold text-purple-600">{service.healthReport.memoryUsageMb.toFixed(0)} MB</p>
                              </div>
                              {service.healthReport.activeConnections !== undefined && (
                                <div className="text-center px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                                  <div className="flex items-center gap-1 mb-1">
                                    <Signal className="h-3 w-3 text-green-600" />
                                    <p className="text-xs text-muted-foreground font-semibold">Connections</p>
                                  </div>
                                  <p className="text-sm font-bold text-green-600">{service.healthReport.activeConnections}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Status Badge & Action */}
                          <div className="flex items-center gap-3">
                            {getStatusBadge(service.status)}
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                          </div>
                        </div>

                        {/* Activity Progress */}
                        {service.currentActivity && (
                          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium flex items-center gap-2">
                                <Activity className="h-3 w-3 text-primary animate-pulse" />
                                {service.currentActivity}
                              </span>
                              {service.activityProgress !== undefined && (
                                <span className="text-sm font-semibold text-primary">{service.activityProgress}%</span>
                              )}
                            </div>
                            {service.activityProgress !== undefined && (
                              <Progress value={service.activityProgress} className="h-2" />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Microservice</DialogTitle>
            <DialogDescription>
              Please provide a friendly name for this microservice. This will be used to identify it in the dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name</Label>
              <Input
                id="serviceName"
                placeholder="e.g., Radius Sync Service - Production"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && serviceName.trim()) {
                    approveService();
                  }
                }}
                autoFocus
              />
            </div>
            {serviceToApprove && (
              <div className="text-sm text-muted-foreground">
                <p>Service ID: <span className="font-mono">{serviceToApprove}</span></p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={approveService}
              disabled={!serviceName.trim()}
              className="bg-green-500 hover:bg-green-600"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
