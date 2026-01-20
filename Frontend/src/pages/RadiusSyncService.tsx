import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Activity, 
  Server, 
  Clock, 
  Cpu, 
  HardDrive, 
  RefreshCw, 
  Play, 
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  Trash2,
  Wifi,
  WifiOff,
  Signal,
  Gauge
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceInfo {
  serviceName: string;
  version: string;
  connectionId: string;
  status: 'Online' | 'Offline' | 'Degraded' | 'Maintenance';
  connectedAt: string;
  lastHeartbeat: string;
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
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [pendingPings, setPendingPings] = useState<Map<string, PendingPing>>(new Map());
  const [isPinging, setIsPinging] = useState<string | null>(null);
  const [dashboardPing, setDashboardPing] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
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
    connection.on('InitialState', (data: { services: ServiceInfo[] }) => {
      setServices(data.services);
      setLastUpdate(new Date());
      if (data.services.length > 0 && !selectedService) {
        setSelectedService(data.services[0].serviceName);
      }
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

    // Handle ping results
    connection.on('PingResult', (data: { serviceName: string; pingId: string; responseTime: string }) => {
      setPendingPings(prev => {
        const newMap = new Map(prev);
        const pending = newMap.get(data.pingId);
        if (pending) {
          const latency = Date.now() - pending.sentAt;
          newMap.delete(data.pingId);
          
          // Update service with ping info
          setServices(prevServices => prevServices.map(s => {
            if (s.serviceName === data.serviceName) {
              const history = [...(s.pingHistory || []), latency].slice(-10); // Keep last 10 pings
              const avgPing = history.reduce((a, b) => a + b, 0) / history.length;
              return { ...s, lastPing: latency, avgPing, pingHistory: history };
            }
            return s;
          }));
          
          addLog({
            serviceName: data.serviceName,
            level: 'info',
            message: `Ping response: ${latency}ms`,
            timestamp: new Date().toISOString()
          });
        }
        return newMap;
      });
      setIsPinging(null);
    });

    startConnection();
  }, [connection, selectedService]);

  const addLog = useCallback((log: Omit<ServiceLog, 'id'>) => {
    const newLog: ServiceLog = {
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`
    };
    setLogs(prev => [...prev.slice(-99), newLog]); // Keep last 100 logs
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const sendCommand = async (serviceName: string, command: string, payload?: unknown) => {
    if (connection?.state !== signalR.HubConnectionState.Connected) return;
    
    try {
      await connection.invoke('SendCommand', serviceName, command, payload);
      addLog({
        serviceName: 'Dashboard',
        level: 'info',
        message: `Sent command "${command}" to ${serviceName}`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to send command:', err);
      addLog({
        serviceName: 'Dashboard',
        level: 'error',
        message: `Failed to send command: ${err}`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const requestSync = async (serviceName: string, syncType: string = 'full') => {
    await sendCommand(serviceName, 'sync', { syncType });
  };

  const pingService = async (serviceName: string) => {
    if (connection?.state !== signalR.HubConnectionState.Connected) return;
    
    setIsPinging(serviceName);
    const pingId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sentAt = Date.now();
    
    setPendingPings(prev => {
      const newMap = new Map(prev);
      newMap.set(pingId, { serviceName, pingId, sentAt });
      return newMap;
    });
    
    try {
      await connection.invoke('PingService', serviceName);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        setPendingPings(prev => {
          const newMap = new Map(prev);
          if (newMap.has(pingId)) {
            newMap.delete(pingId);
            setIsPinging(null);
            addLog({
              serviceName,
              level: 'warning',
              message: 'Ping timeout (>5000ms)',
              timestamp: new Date().toISOString()
            });
          }
          return newMap;
        });
      }, 5000);
    } catch (err) {
      console.error('Failed to ping service:', err);
      setIsPinging(null);
      setPendingPings(prev => {
        const newMap = new Map(prev);
        newMap.delete(pingId);
        return newMap;
      });
    }
  };

  // Measure dashboard ping every 5 seconds
  useEffect(() => {
    if (connectionState !== 'Connected') return;
    
    // Initial ping already done in connection setup
    const interval = setInterval(() => {
      measureDashboardPing();
    }, 5000); // Every 5 seconds for more responsive updates
    
    return () => clearInterval(interval);
  }, [connectionState, measureDashboardPing]);

  const getPingQuality = (ping: number | undefined) => {
    if (ping === undefined) return { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted' };
    if (ping < 50) return { label: 'Excellent', color: 'text-green-500', bg: 'bg-green-500' };
    if (ping < 100) return { label: 'Good', color: 'text-emerald-500', bg: 'bg-emerald-500' };
    if (ping < 200) return { label: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (ping < 500) return { label: 'Poor', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { label: 'Bad', color: 'text-red-500', bg: 'bg-red-500' };
  };

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

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info': return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Terminal className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatUptime = (connectedAt: string) => {
    const diff = Date.now() - new Date(connectedAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const selectedServiceInfo = services.find(s => s.serviceName === selectedService);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('radiusSyncService.title', 'Radius Sync Service')}</h1>
          <p className="text-muted-foreground">
            {t('radiusSyncService.subtitle', 'Monitor and manage connected microservices')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Real-time clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{currentTime.toLocaleTimeString()}</span>
          </div>
          
          {/* Dashboard Connection Quality */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors",
                    connectionState === 'Connected' ? "bg-muted hover:bg-muted/80" : "bg-destructive/10"
                  )}
                  onClick={() => measureDashboardPing()}
                >
                  {connectionState === 'Connected' ? (
                    <Wifi className={cn("h-4 w-4", getPingQuality(dashboardPing ?? undefined).color)} />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive" />
                  )}
                  <span className={cn("text-sm font-bold tabular-nums", getPingQuality(dashboardPing ?? undefined).color)}>
                    {dashboardPing !== null ? `${dashboardPing}ms` : '--'}
                  </span>
                  {dashboardPing !== null && (
                    <div className={cn("h-2 w-2 rounded-full animate-pulse", getPingQuality(dashboardPing).bg)} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">Dashboard Connection</p>
                  <p className="text-xs text-muted-foreground">Click to refresh</p>
                  {dashboardPing !== null && (
                    <p className={cn("font-medium", getPingQuality(dashboardPing).color)}>
                      Quality: {getPingQuality(dashboardPing).label}
                    </p>
                  )}
                  {lastUpdate && (
                    <p className="text-xs text-muted-foreground">
                      Last update: {lastUpdate.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Badge variant={connectionState === 'Connected' ? 'default' : 'secondary'} className="gap-1">
            {connectionState === 'Connected' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : connectionState === 'Reconnecting' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            {connectionState}
          </Badge>
        </div>
      </div>

      {/* Services Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('radiusSyncService.totalServices', 'Total Services')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{services.length}</div>
            <p className="text-xs text-muted-foreground">
              {services.filter(s => s.status === 'Online').length} online
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('radiusSyncService.healthyServices', 'Healthy')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {services.filter(s => s.healthReport?.isHealthy).length}
            </div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('radiusSyncService.degraded', 'Degraded')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {services.filter(s => s.status === 'Degraded').length}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('radiusSyncService.offline', 'Offline')}</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {services.filter(s => s.status === 'Offline').length}
            </div>
            <p className="text-xs text-muted-foreground">Disconnected</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Services List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              {t('radiusSyncService.connectedServices', 'Connected Services')}
            </CardTitle>
            <CardDescription>
              {t('radiusSyncService.selectService', 'Select a service to view details')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {services.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <Server className="h-12 w-12 mb-4 opacity-50" />
                  <p>{t('radiusSyncService.noServices', 'No services connected')}</p>
                  <p className="text-sm">Start RadiusSyncService to see it here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map((service) => (
                    <div
                      key={service.serviceName}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        selectedService === service.serviceName
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedService(service.serviceName)}
                    >
                      <div className={cn("h-3 w-3 rounded-full", getStatusColor(service.status))} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{service.serviceName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>v{service.version}</span>
                          {service.lastPing !== undefined && (
                            <>
                              <span>•</span>
                              <span className={getPingQuality(service.lastPing).color}>
                                {service.lastPing}ms
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(service.status)}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {selectedServiceInfo?.serviceName || t('radiusSyncService.serviceDetails', 'Service Details')}
            </CardTitle>
            <CardDescription>
              {selectedServiceInfo 
                ? `Version ${selectedServiceInfo.version} • ${selectedServiceInfo.status}`
                : t('radiusSyncService.selectServicePrompt', 'Select a service to view its details')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedServiceInfo ? (
              <div className="space-y-6">
                {/* Status and Actions */}
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedServiceInfo.status)}
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => pingService(selectedServiceInfo.serviceName)}
                      disabled={isPinging === selectedServiceInfo.serviceName}
                    >
                      {isPinging === selectedServiceInfo.serviceName ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Signal className="h-4 w-4 mr-1" />
                      )}
                      Ping
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => requestSync(selectedServiceInfo.serviceName)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Sync Now
                    </Button>
                  </div>
                </div>

                {/* Ping/Latency Info */}
                {(selectedServiceInfo.lastPing !== undefined || selectedServiceInfo.avgPing !== undefined) && (
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Gauge className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Connection Quality</span>
                      <Badge variant="outline" className={cn("ml-auto", getPingQuality(selectedServiceInfo.lastPing).color)}>
                        {getPingQuality(selectedServiceInfo.lastPing).label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{selectedServiceInfo.lastPing ?? '--'}</p>
                        <p className="text-xs text-muted-foreground">Last Ping (ms)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{selectedServiceInfo.avgPing?.toFixed(0) ?? '--'}</p>
                        <p className="text-xs text-muted-foreground">Avg Ping (ms)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{selectedServiceInfo.pingHistory?.length ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Samples</p>
                      </div>
                    </div>
                    {/* Mini ping chart */}
                    {selectedServiceInfo.pingHistory && selectedServiceInfo.pingHistory.length > 1 && (
                      <div className="mt-3 flex items-end gap-1 h-8">
                        {selectedServiceInfo.pingHistory.map((ping, i) => {
                          const maxPing = Math.max(...selectedServiceInfo.pingHistory!);
                          const height = Math.max(10, (ping / maxPing) * 100);
                          return (
                            <TooltipProvider key={i}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn("flex-1 rounded-sm transition-all", getPingQuality(ping).bg)}
                                    style={{ height: `${height}%` }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{ping}ms</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Activity Progress */}
                {selectedServiceInfo.currentActivity && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{selectedServiceInfo.currentActivity}</span>
                      {selectedServiceInfo.activityProgress !== undefined && (
                        <span className="font-medium">{Math.round(selectedServiceInfo.activityProgress)}%</span>
                      )}
                    </div>
                    {selectedServiceInfo.activityProgress !== undefined && (
                      <Progress value={selectedServiceInfo.activityProgress} className="h-2" />
                    )}
                  </div>
                )}

                <Separator />

                {/* Health Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Connected
                    </div>
                    <p className="font-medium">{formatUptime(selectedServiceInfo.connectedAt)} ago</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      Last Heartbeat
                    </div>
                    <p className="font-medium">{formatTimestamp(selectedServiceInfo.lastHeartbeat)}</p>
                  </div>
                  {selectedServiceInfo.healthReport && (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Cpu className="h-4 w-4" />
                          CPU Usage
                        </div>
                        <p className="font-medium">{selectedServiceInfo.healthReport.cpuUsage.toFixed(1)}%</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <HardDrive className="h-4 w-4" />
                          Memory
                        </div>
                        <p className="font-medium">{selectedServiceInfo.healthReport.memoryUsageMb.toFixed(1)} MB</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Metadata */}
                {selectedServiceInfo.metadata && Object.keys(selectedServiceInfo.metadata).length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(selectedServiceInfo.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono text-xs">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Activity className="h-12 w-12 mb-4 opacity-50" />
                <p>{t('radiusSyncService.noServiceSelected', 'No service selected')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Logs Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {t('radiusSyncService.activityLogs', 'Activity Logs')}
            </CardTitle>
            <CardDescription>
              {t('radiusSyncService.logsDescription', 'Real-time logs from connected services')}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] rounded-md border bg-muted/30 p-4">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>{t('radiusSyncService.noLogs', 'No logs yet')}</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    {getLogIcon(log.level)}
                    <span className="text-muted-foreground">[{formatTimestamp(log.timestamp)}]</span>
                    <span className="text-primary font-medium">{log.serviceName}:</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
