import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Gauge,
  RefreshCw,
  Zap,
  LayoutGrid,
  Container,
  Download,
  Power,
  Square,
  Box,
  Network,
  Database,
  ExternalLink,
  Copy,
  Eye,
  Layers
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

// Docker-related interfaces
interface DockerStatus {
  platform: string;
  checkedAt: string;
  dockerInstalled: boolean;
  dockerVersion?: string;
  dockerRunning: boolean;
  dockerInfo?: DockerInfo;
  dockerComposeInstalled: boolean;
  dockerComposeVersion?: string;
  dockerComposeV2: boolean;
  runningContainers: ContainerInfo[];
  allContainers: ContainerInfo[];
  images: ImageInfo[];
  networks: NetworkInfo[];
  volumes: VolumeInfo[];
}

interface DockerInfo {
  serverVersion?: string;
  operatingSystem?: string;
  architecture?: string;
  containers: number;
  containersRunning: number;
  containersPaused: number;
  containersStopped: number;
  images: number;
  memoryTotal: number;
  ncpu: number;
}

interface ContainerInfo {
  id?: string;
  names?: string;
  image?: string;
  status?: string;
  state?: string;
  ports?: string;
  createdAt?: string;
}

interface ImageInfo {
  id?: string;
  repository?: string;
  tag?: string;
  size?: string;
  createdAt?: string;
  createdSince?: string;
}

interface NetworkInfo {
  id?: string;
  name?: string;
  driver?: string;
  scope?: string;
}

interface VolumeInfo {
  name?: string;
  driver?: string;
  mountpoint?: string;
}

interface InstallationStep {
  order: number;
  title: string;
  description: string;
  command?: string;
}

interface DockerInstallGuide {
  platform: string;
  recommendedMethod: string;
  steps: InstallationStep[];
  alternativeMethod?: string;
  alternativeSteps?: InstallationStep[];
  notes?: string;
  downloadUrl?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RadiusSyncServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [service, setService] = useState<ServiceInfo | null>(null);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [isPinging, setIsPinging] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Handle tab change and update URL
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    navigate(`?tab=${value}`, { replace: true });
  };

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
      if (found) {
        setService(found);
        setLastUpdate(new Date());
      }
    });

    connection.on('ServiceConnected', (serviceInfo: ServiceInfo) => {
      if (serviceInfo.serviceName === serviceName) {
        setService(serviceInfo);
        setLastUpdate(new Date());
      }
    });

    connection.on('ServiceDisconnected', (data: { serviceName: string; disconnectedAt: string }) => {
      if (data.serviceName === serviceName) {
        setService(prev => prev ? { ...prev, status: 'Offline' as const } : null);
        setLastUpdate(new Date());
      }
    });

    connection.on('ServiceHeartbeat', (data: { 
      serviceName: string; 
      status: string; 
      lastHeartbeat: string;
      healthReport: ServiceInfo['healthReport'];
    }) => {
      if (data.serviceName === serviceName) {
        setService(prev => prev ? { 
          ...prev, 
          status: data.status as ServiceInfo['status'], 
          lastHeartbeat: data.lastHeartbeat,
          healthReport: data.healthReport 
        } : null);
        setLastUpdate(new Date());
      }
    });

    connection.on('ServiceActivity', (data: { 
      serviceName: string; 
      activity: string; 
      progress?: number;
      timestamp: string;
    }) => {
      if (data.serviceName === serviceName) {
        setService(prev => prev ? { 
          ...prev, 
          currentActivity: data.activity, 
          activityProgress: data.progress 
        } : null);
        setLastUpdate(new Date());
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
    const diff = currentTime.getTime() - new Date(connectedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = currentTime.getTime() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {service.displayName || service.serviceName}
          </h1>
          <p className="text-muted-foreground">Version {service.version}</p>
        </div>
        <div className="flex gap-3 items-center">
          {/* Last Update Indicator */}
          {lastUpdate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-2 px-3 py-2 cursor-help">
                    <RefreshCw className="h-3 w-3 text-green-500 animate-spin" style={{ animationDuration: '3s' }} />
                    <span className="text-xs">Updated {getTimeAgo(lastUpdate.toISOString())}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Last updated: {lastUpdate.toLocaleTimeString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {getStatusBadge(service.status)}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Container className="h-4 w-4" />
            Services
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 mt-6">
          {/* Health Metrics */}
          <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div>
                  <div>Health Metrics</div>
                  <CardDescription className="text-xs mt-1">Live performance monitoring, connectivity and ping latency</CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(service.lastPing !== undefined) && (
                    <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/30 dark:to-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                        <Gauge className="h-4 w-4 text-cyan-600" />
                        Ping
                      </div>
                      <p className="text-2xl font-bold text-cyan-600">{service.lastPing ? `${service.lastPing} MS` : '--'}</p>
                      <p className="text-xs text-cyan-600/70">Last</p>
                    </div>
                  )}
                  {(service.avgPing !== undefined) && (
                    <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                        <Signal className="h-4 w-4 text-indigo-600" />
                        Avg Ping
                      </div>
                      <p className="text-2xl font-bold text-indigo-600">{service.avgPing ? `${service.avgPing.toFixed(0)} MS` : '--'}</p>
                      <p className="text-xs text-indigo-600/70">Average</p>
                    </div>
                  )}
                  <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                      <Zap className="h-4 w-4 text-blue-600" />
                      Connected
                    </div>
                    <p className="text-2xl font-bold text-blue-600">{formatUptime(service.connectedAt)}</p>
                  </div>
                  <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                      <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                      Last Heartbeat
                    </div>
                    <p className="text-xl font-bold text-green-600">{formatTimestamp(service.lastHeartbeat)}</p>
                    <p className="text-xs text-green-600/70">{getTimeAgo(service.lastHeartbeat)}</p>
                  </div>
                  {service.healthReport && (
                    <>
                      <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                          <Cpu className="h-4 w-4 text-purple-600" />
                          CPU Usage
                        </div>
                        <p className="text-2xl font-bold text-purple-600">{service.healthReport.cpuUsage.toFixed(1)}%</p>
                        <Progress value={service.healthReport.cpuUsage} className="h-1.5" />
                      </div>
                      <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
                          <HardDrive className="h-4 w-4 text-orange-600" />
                          Memory
                        </div>
                        <p className="text-2xl font-bold text-orange-600">{service.healthReport.memoryUsageMb.toFixed(1)} MB</p>
                        {service.healthReport.customMetrics?.memoryLimit && (
                          <Progress 
                            value={(service.healthReport.memoryUsageMb / Number(service.healthReport.customMetrics.memoryLimit)) * 100} 
                            className="h-1.5" 
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

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
                <div className="space-y-1">
                  {Object.entries(service.metadata).map(([key, value]) => (
                    <div key={key} className="border-b pb-1">
                      <span className="text-muted-foreground font-medium text-xs">{key}:</span>
                      <p className="font-mono text-xs break-all text-muted-foreground">{value}</p>
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
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Container className="h-5 w-5" />
                Docker Services
              </CardTitle>
              <CardDescription>
                Services running on this microservice instance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Container className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">Docker Services Configuration</p>
                <p className="text-sm mt-2">This section will display running Docker services</p>
                <p className="text-xs mt-4 text-muted-foreground/70">Coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
