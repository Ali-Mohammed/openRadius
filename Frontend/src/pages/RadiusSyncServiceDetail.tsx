import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Clock, 
  Cpu, 
  HardDrive, 
  Play, 
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Signal,
  Gauge
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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RadiusSyncServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [isPinging, setIsPinging] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Initialize SignalR connection
  useEffect(() => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/microservices`)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    setConnection(newConnection);

    return () => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.invoke('LeaveDashboard').catch(() => {});
        newConnection.stop();
      }
    };
  }, []);

  // Setup SignalR handlers
  useEffect(() => {
    if (!connection) return;

    connection.on('InitialState', (data: { services: ServiceInfo[] } | ServiceInfo[]) => {
      const servicesList = Array.isArray(data) ? data : data.services;
      const found = servicesList.find(s => s.serviceName === serviceName);
      if (found) setService(found);
    });

    connection.on('ServiceConnected', (serviceInfo: ServiceInfo) => {
      if (serviceInfo.serviceName === serviceName) {
        setService(serviceInfo);
      }
    });

    connection.on('ServiceDisconnected', (name: string) => {
      if (name === serviceName) {
        setService(prev => prev ? { ...prev, status: 'Offline' as const } : null);
      }
    });

    connection.on('ServiceHeartbeat', (name: string, heartbeat: ServiceInfo) => {
      if (name === serviceName) {
        setService(prev => prev ? { ...prev, ...heartbeat } : heartbeat);
      }
    });

    connection.on('ServiceActivity', (name: string, activity: string, progress?: number) => {
      if (name === serviceName) {
        setService(prev => prev ? { ...prev, currentActivity: activity, activityProgress: progress } : null);
      }
    });

    connection.on('ServiceLog', (log: ServiceLog) => {
      if (log.serviceName === serviceName) {
        setLogs(prev => [...prev.slice(-99), log]);
      }
    });

    connection.on('PingResult', (data: { serviceName: string; pingId: string; latencyMs: number; responseTime: string }) => {
      if (data.serviceName !== serviceName) return;

      const latency = Math.round(data.latencyMs);

      setService(prev => {
        if (!prev) return null;
        const newHistory = [...(prev.pingHistory || []), latency].slice(-10);
        const avgPing = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
        return { ...prev, lastPing: latency, avgPing, pingHistory: newHistory };
      });

      setIsPinging(false);
    });

    connection.start()
      .then(() => connection.invoke('JoinDashboard'))
      .catch(err => console.error('SignalR connection error:', err));

    return () => {
      connection.off('InitialState');
      connection.off('ServiceConnected');
      connection.off('ServiceDisconnected');
      connection.off('ServiceHeartbeat');
      connection.off('ServiceActivity');
      connection.off('ServiceLog');
      connection.off('PingResult');
    };
  }, [connection, serviceName]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const pingService = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsPinging(true);
    
    try {
      await connection.invoke('PingService', serviceName);
    } catch (err) {
      console.error('Ping failed:', err);
      setIsPinging(false);
    }

    // Reset isPinging after 5 seconds if no response
    setTimeout(() => {
      setIsPinging(false);
    }, 5000);
  };

  const requestSync = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    try {
      await connection.invoke('SendCommand', serviceName, 'TriggerSync', { immediate: true });
    } catch (err) {
      console.error('Sync request failed:', err);
    }
  };

  const getStatusBadge = (status: ServiceInfo['status']) => {
    const variants = {
      Online: { variant: 'default' as const, icon: CheckCircle2, className: 'bg-green-500' },
      Offline: { variant: 'secondary' as const, icon: XCircle, className: 'bg-gray-500' },
      Degraded: { variant: 'destructive' as const, icon: AlertCircle, className: 'bg-yellow-500' },
      Maintenance: { variant: 'outline' as const, icon: AlertCircle, className: 'bg-blue-500' },
    };
    const config = variants[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const getPingQuality = (ping?: number) => {
    if (ping === undefined) return { label: 'Unknown', color: 'text-muted-foreground', bg: 'bg-muted' };
    if (ping < 50) return { label: 'Excellent', color: 'text-green-500', bg: 'bg-green-500' };
    if (ping < 100) return { label: 'Good', color: 'text-emerald-500', bg: 'bg-emerald-500' };
    if (ping < 200) return { label: 'Fair', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    if (ping < 500) return { label: 'Poor', color: 'text-orange-500', bg: 'bg-orange-500' };
    return { label: 'Bad', color: 'text-red-500', bg: 'bg-red-500' };
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

  const getLogIcon = (level: ServiceLog['level']) => {
    const icons = {
      info: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
      warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
      error: <XCircle className="h-4 w-4 text-red-500" />,
      debug: <Activity className="h-4 w-4 text-gray-500" />,
    };
    return icons[level];
  };

  if (!service) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading service details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{service.serviceName}</h1>
          <p className="text-muted-foreground">Version {service.version}</p>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(service.status)}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button 
          variant="outline"
          onClick={pingService}
          disabled={isPinging}
        >
          {isPinging ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Signal className="h-4 w-4 mr-2" />
          )}
          Ping Service
        </Button>
        <Button onClick={requestSync}>
          <Play className="h-4 w-4 mr-2" />
          Sync Now
        </Button>
      </div>

      {/* Main Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Connection Quality */}
        {(service.lastPing !== undefined || service.avgPing !== undefined) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Connection Quality
              </CardTitle>
              <CardDescription>
                <Badge variant="outline" className={cn(getPingQuality(service.lastPing).color)}>
                  {getPingQuality(service.lastPing).label}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{service.lastPing ?? '--'}</p>
                  <p className="text-xs text-muted-foreground">Last Ping (ms)</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{service.avgPing?.toFixed(0) ?? '--'}</p>
                  <p className="text-xs text-muted-foreground">Avg Ping (ms)</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">{service.pingHistory?.length ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Samples</p>
                </div>
              </div>
              {service.pingHistory && service.pingHistory.length > 1 && (
                <div className="flex items-end gap-1 h-16">
                  {service.pingHistory.map((ping, i) => {
                    const maxPing = Math.max(...service.pingHistory!);
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
            </CardContent>
          </Card>
        )}

        {/* Health Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Health Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Connected
                </div>
                <p className="text-xl font-bold">{formatUptime(service.connectedAt)}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Activity className="h-4 w-4" />
                  Last Heartbeat
                </div>
                <p className="text-xl font-bold">{formatTimestamp(service.lastHeartbeat)}</p>
              </div>
              {service.healthReport && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Cpu className="h-4 w-4" />
                      CPU Usage
                    </div>
                    <p className="text-xl font-bold">{service.healthReport.cpuUsage.toFixed(1)}%</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <HardDrive className="h-4 w-4" />
                      Memory
                    </div>
                    <p className="text-xl font-bold">{service.healthReport.memoryUsageMb.toFixed(1)} MB</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Progress */}
      {service.currentActivity && (
        <Card>
          <CardHeader>
            <CardTitle>Current Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{service.currentActivity}</span>
              {service.activityProgress !== undefined && (
                <span className="font-bold">{Math.round(service.activityProgress)}%</span>
              )}
            </div>
            {service.activityProgress !== undefined && (
              <Progress value={service.activityProgress} className="h-2" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      {service.metadata && Object.keys(service.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(service.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground font-medium">{key}:</span>
                  <span className="font-mono text-sm">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Activity Logs
            </CardTitle>
            <CardDescription>Real-time logs from this service</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border bg-muted/30 p-4">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No logs yet</p>
              </div>
            ) : (
              <div className="space-y-2 font-mono text-sm">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    {getLogIcon(log.level)}
                    <span className="text-muted-foreground">[{formatTimestamp(log.timestamp)}]</span>
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
