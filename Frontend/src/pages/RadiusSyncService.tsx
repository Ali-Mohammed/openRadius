import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  Signal,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceInfo {
  serviceName: string;
  version: string;
  connectionId: string;
  status: 'Online' | 'Offline' | 'Degraded' | 'Maintenance';
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
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
  const navigate = useNavigate();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<string>('Disconnected');
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [dashboardPing, setDashboardPing] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
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

  const approveService = async (serviceName: string) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    try {
      await connection.invoke('ApproveService', serviceName);
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

      {/* Services List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                {t('radiusSyncService.connectedServices', 'Connected Services')}
              </CardTitle>
              <CardDescription>
                {services.length} service{services.length !== 1 ? 's' : ''} connected • Click to view details
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {services.filter(s => s.status === 'Online').length} Online
              </Badge>
              {services.filter(s => s.status === 'Degraded').length > 0 && (
                <Badge variant="outline" className="gap-1 text-yellow-500">
                  <AlertCircle className="h-3 w-3" />
                  {services.filter(s => s.status === 'Degraded').length} Degraded
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Server className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t('radiusSyncService.noServices', 'No services connected')}</p>
              <p className="text-sm mt-2">Start a microservice to see it here</p>
              <div className="mt-4 p-3 rounded-md bg-muted/50 text-left text-xs max-w-md">
                <p className="font-mono">cd microservices/RadiusSyncService</p>
                <p className="font-mono">dotnet run</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.serviceName}
                  className="rounded-lg border p-4 hover:border-primary/50 hover:bg-muted/50 cursor-pointer transition-all flex items-center gap-4"
                  onClick={() => navigate(`/microservices/radius-sync/${encodeURIComponent(service.serviceName)}`)}
                >
                  {/* Status Indicator */}
                  <div className={cn("h-3 w-3 rounded-full flex-shrink-0", getStatusColor(service.status))} />
                  
                  {/* Service Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className="font-semibold text-lg">{service.serviceName}</h3>
                      <span className="text-sm text-muted-foreground">v{service.version}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Connected {formatUptime(service.connectedAt)} ago
                    </p>
                  </div>

                  {/* Health Metrics */}
                  {service.healthReport && (
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-sm font-medium">{service.healthReport.cpuUsage.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">CPU</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{service.healthReport.memoryUsageMb.toFixed(0)} MB</p>
                        <p className="text-xs text-muted-foreground">Memory</p>
                      </div>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(service.status)}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
