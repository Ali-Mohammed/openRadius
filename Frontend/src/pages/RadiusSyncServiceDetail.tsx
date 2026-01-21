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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Layers,
  RotateCw
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
  
  // Docker-related state
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [dockerInstallGuide, setDockerInstallGuide] = useState<DockerInstallGuide | null>(null);
  const [isLoadingDocker, setIsLoadingDocker] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [containerLogs, setContainerLogs] = useState<{ containerId: string; logs: string } | null>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  
  // Container action state
  const [containerToDelete, setContainerToDelete] = useState<ContainerInfo | null>(null);
  const [containerToRestart, setContainerToRestart] = useState<ContainerInfo | null>(null);
  const [containerForLogs, setContainerForLogs] = useState<ContainerInfo | null>(null);
  const [isProcessingContainer, setIsProcessingContainer] = useState<string | null>(null);
  const [containerActionResult, setContainerActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isInstallingDocker, setIsInstallingDocker] = useState(false);
  const [installProgress, setInstallProgress] = useState<{ message: string; progress: number } | null>(null);

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

    // Docker-related event handlers
    connection.on('DockerStatus', (data: { serviceName: string; dockerStatus: DockerStatus; reportedAt: string }) => {
      if (data.serviceName === serviceName) {
        setDockerStatus(data.dockerStatus);
        setIsLoadingDocker(false);
        setDockerError(null);
      }
    });

    connection.on('DockerInstallGuide', (data: { serviceName: string; installGuide: DockerInstallGuide; reportedAt: string }) => {
      if (data.serviceName === serviceName) {
        setDockerInstallGuide(data.installGuide);
        setShowInstallGuide(true);
        setIsLoadingDocker(false);
      }
    });

    connection.on('ContainerLogs', (data: { serviceName: string; containerId: string; logsData: { success: boolean; logs: string; error: string }; reportedAt: string }) => {
      if (data.serviceName === serviceName) {
        if (data.logsData.success) {
          setContainerLogs({ containerId: data.containerId, logs: data.logsData.logs });
        } else {
          setDockerError(`Failed to get logs: ${data.logsData.error}`);
        }
      }
    });

    connection.on('DockerInstallProgress', (data: { serviceName: string; progressData: { message: string; progress: number }; reportedAt: string }) => {
      if (data.serviceName === serviceName) {
        setInstallProgress(data.progressData);
      }
    });

    connection.on('DockerInstallResult', (data: { serviceName: string; installResult: { success: boolean; message: string; requiresManualAction: boolean }; reportedAt: string }) => {
      if (data.serviceName === serviceName) {
        setIsInstallingDocker(false);
        setInstallProgress(null);
        if (data.installResult.success) {
          setDockerError(null);
        } else {
          setDockerError(data.installResult.message);
        }
      }
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
      connection.off('DockerStatus');
      connection.off('DockerInstallGuide');
      connection.off('ContainerLogs');
      connection.off('DockerInstallProgress');
      connection.off('DockerInstallResult');
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

  // Docker-related functions
  const requestDockerStatus = useCallback(async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsLoadingDocker(true);
    setDockerError(null);
    
    try {
      await connection.invoke('RequestDockerStatus', serviceName);
    } catch (err) {
      console.error('Docker status request failed:', err);
      setDockerError('Failed to request Docker status');
      setIsLoadingDocker(false);
    }
  }, [connection, serviceName]);

  const requestDockerInstallGuide = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsLoadingDocker(true);
    
    try {
      await connection.invoke('RequestDockerInstallGuide', serviceName);
    } catch (err) {
      console.error('Docker install guide request failed:', err);
      setIsLoadingDocker(false);
    }
  };

  const requestDockerStart = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsLoadingDocker(true);
    
    try {
      await connection.invoke('RequestDockerStart', serviceName);
    } catch (err) {
      console.error('Docker start request failed:', err);
      setIsLoadingDocker(false);
    }
  };

  const requestDockerInstall = async () => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsInstallingDocker(true);
    setInstallProgress({ message: 'Starting installation...', progress: 0 });
    setDockerError(null);
    
    try {
      await connection.invoke('RequestDockerInstall', serviceName);
    } catch (err) {
      console.error('Docker install request failed:', err);
      setIsInstallingDocker(false);
      setInstallProgress(null);
      setDockerError('Failed to start Docker installation');
    }
  };

  const requestContainerStop = async (containerId: string) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    try {
      await connection.invoke('RequestContainerStop', serviceName, containerId);
    } catch (err) {
      console.error('Container stop request failed:', err);
    }
  };

  const requestContainerRemove = async (containerId: string, force: boolean = false) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    try {
      await connection.invoke('RequestContainerRemove', serviceName, containerId, force);
    } catch (err) {
      console.error('Container remove request failed:', err);
    }
  };

  const requestContainerLogs = async (containerId: string) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    try {
      await connection.invoke('RequestContainerLogs', serviceName, containerId, 100);
    } catch (err) {
      console.error('Container logs request failed:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteContainer = async (containerId: string) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsProcessingContainer(containerId);
    setContainerToDelete(null);
    
    try {
      await connection.invoke('RequestContainerRemove', serviceName, containerId, true);
      setContainerActionResult({ success: true, message: 'Container deleted successfully' });
      // Refresh Docker status after delete
      setTimeout(() => requestDockerStatus(), 1000);
    } catch (err) {
      console.error('Container remove request failed:', err);
      setContainerActionResult({ success: false, message: 'Failed to delete container' });
    } finally {
      setIsProcessingContainer(null);
      setTimeout(() => setContainerActionResult(null), 3000);
    }
  };

  const handleRestartContainer = async (containerId: string, isRunning: boolean) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected || !serviceName) return;
    
    setIsProcessingContainer(containerId);
    setContainerToRestart(null);
    
    try {
      if (isRunning) {
        // Stop then start (restart)
        await connection.invoke('RequestContainerStop', serviceName, containerId);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await connection.invoke('RequestContainerStart', serviceName, containerId);
        setContainerActionResult({ success: true, message: 'Container restarted successfully' });
      } else {
        // Just start
        await connection.invoke('RequestContainerStart', serviceName, containerId);
        setContainerActionResult({ success: true, message: 'Container started successfully' });
      }
      // Refresh Docker status after restart
      setTimeout(() => requestDockerStatus(), 1000);
    } catch (err) {
      console.error('Container restart request failed:', err);
      setContainerActionResult({ success: false, message: 'Failed to restart container' });
    } finally {
      setIsProcessingContainer(null);
      setTimeout(() => setContainerActionResult(null), 3000);
    }
  };

  // Automatically request logs when dialog opens
  useEffect(() => {
    if (containerForLogs) {
      requestContainerLogs(containerForLogs.id!);
    }
  }, [containerForLogs]);

  // Request Docker status when Services tab is active
  useEffect(() => {
    if (activeTab === 'services' && !dockerStatus && !isLoadingDocker) {
      requestDockerStatus();
    }
  }, [activeTab, dockerStatus, isLoadingDocker, requestDockerStatus]);

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
          {/* Docker Status Header */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Container className="h-5 w-5" />
                    Docker Environment
                  </CardTitle>
                  <CardDescription>
                    Docker installation status and container management
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={requestDockerStatus}
                    disabled={isLoadingDocker}
                  >
                    {isLoadingDocker ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingDocker && !dockerStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Checking Docker status...</span>
                </div>
              ) : dockerStatus ? (
                <div className="space-y-6">
                  {/* Installation Status */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Docker Engine */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      dockerStatus.dockerInstalled 
                        ? dockerStatus.dockerRunning 
                          ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                          : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
                        : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Box className={cn(
                          "h-5 w-5",
                          dockerStatus.dockerInstalled 
                            ? dockerStatus.dockerRunning ? "text-green-600" : "text-yellow-600"
                            : "text-red-600"
                        )} />
                        <span className="font-medium text-sm">Docker Engine</span>
                      </div>
                      {dockerStatus.dockerInstalled ? (
                        <>
                          <p className="text-lg font-bold">{dockerStatus.dockerVersion || 'Installed'}</p>
                          <Badge variant={dockerStatus.dockerRunning ? "default" : "secondary"} className="mt-1">
                            {dockerStatus.dockerRunning ? 'Running' : 'Stopped'}
                          </Badge>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-red-600">Not Installed</p>
                          <div className="flex gap-2 mt-2">
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={requestDockerInstall}
                              disabled={isInstallingDocker}
                            >
                              {isInstallingDocker ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              Install
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={requestDockerInstallGuide}
                            >
                              Guide
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Docker Compose */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      dockerStatus.dockerComposeInstalled 
                        ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className={cn(
                          "h-5 w-5",
                          dockerStatus.dockerComposeInstalled ? "text-green-600" : "text-red-600"
                        )} />
                        <span className="font-medium text-sm">Docker Compose</span>
                      </div>
                      {dockerStatus.dockerComposeInstalled ? (
                        <>
                          <p className="text-lg font-bold">{dockerStatus.dockerComposeVersion || 'Installed'}</p>
                          <Badge variant="outline" className="mt-1">
                            {dockerStatus.dockerComposeV2 ? 'V2 (Plugin)' : 'V1'}
                          </Badge>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-red-600">Not Installed</p>
                      )}
                    </div>

                    {/* Platform */}
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Terminal className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-sm">Platform</span>
                      </div>
                      <p className="text-lg font-bold">{dockerStatus.platform}</p>
                      {dockerStatus.dockerInfo && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {dockerStatus.dockerInfo.architecture}
                        </p>
                      )}
                    </div>

                    {/* Resources Summary */}
                    {dockerStatus.dockerRunning && dockerStatus.dockerInfo && (
                      <div className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium text-sm">Resources</span>
                        </div>
                        <p className="text-lg font-bold">{dockerStatus.dockerInfo.ncpu} CPUs</p>
                        <p className="text-xs text-muted-foreground">
                          {(dockerStatus.dockerInfo.memoryTotal / (1024 * 1024 * 1024)).toFixed(1)} GB RAM
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Start Docker Button if not running */}
                  {dockerStatus.dockerInstalled && !dockerStatus.dockerRunning && (
                    <div className="flex items-center justify-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                      <span className="text-sm mr-4">Docker is installed but not running.</span>
                      <Button onClick={requestDockerStart} disabled={isLoadingDocker}>
                        <Power className="h-4 w-4 mr-2" />
                        Start Docker
                      </Button>
                    </div>
                  )}

                  {/* Installation Progress */}
                  {isInstallingDocker && installProgress && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                        <span className="font-medium text-blue-700 dark:text-blue-300">Installing Docker...</span>
                      </div>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">{installProgress.message}</p>
                      <Progress value={installProgress.progress} className="h-2" />
                      <p className="text-xs text-blue-500 mt-1 text-right">{installProgress.progress}%</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Container className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">Click Refresh to check Docker status</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Docker Info Stats */}
          {dockerStatus?.dockerRunning && dockerStatus.dockerInfo && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">{dockerStatus.dockerInfo.containersRunning}</div>
                  <p className="text-xs text-muted-foreground">Running Containers</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-gray-500">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-gray-600">{dockerStatus.dockerInfo.containersStopped}</div>
                  <p className="text-xs text-muted-foreground">Stopped Containers</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-yellow-500">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{dockerStatus.dockerInfo.containersPaused}</div>
                  <p className="text-xs text-muted-foreground">Paused Containers</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-purple-600">{dockerStatus.dockerInfo.images}</div>
                  <p className="text-xs text-muted-foreground">Images</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{dockerStatus.dockerInfo.containers}</div>
                  <p className="text-xs text-muted-foreground">Total Containers</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Running Containers */}
          {dockerStatus?.dockerRunning && dockerStatus.runningContainers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Play className="h-5 w-5 text-green-600" />
                  Running Containers
                  <Badge variant="secondary" className="ml-2">{dockerStatus.runningContainers.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dockerStatus.runningContainers.map((container) => (
                    <div key={container.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <div>
                          <p className="font-medium text-sm">{container.names}</p>
                          <p className="text-xs text-muted-foreground">{container.image}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{container.status}</Badge>
                        {container.ports && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-xs">
                                  <Network className="h-3 w-3 mr-1" />
                                  Ports
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs">{container.ports}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setContainerForLogs(container)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Logs</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setContainerToRestart(container)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  {isProcessingContainer === container.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Restart Container</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => copyToClipboard(container.id!)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy ID</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => requestContainerStop(container.id!)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  <Square className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Stop Container</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stopped Containers */}
          {dockerStatus?.dockerRunning && dockerStatus.allContainers.filter(c => c.state !== 'running').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Square className="h-5 w-5 text-gray-500" />
                  Stopped Containers
                  <Badge variant="secondary" className="ml-2">
                    {dockerStatus.allContainers.filter(c => c.state !== 'running').length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dockerStatus.allContainers.filter(c => c.state !== 'running').map((container) => (
                    <div key={container.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border opacity-70">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-gray-400" />
                        <div>
                          <p className="font-medium text-sm">{container.names}</p>
                          <p className="text-xs text-muted-foreground">{container.image}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{container.status}</Badge>
                        <div className="flex gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setContainerForLogs(container)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Logs</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => setContainerToRestart(container)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  {isProcessingContainer === container.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Start Container</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setContainerToDelete(container)}
                                  disabled={isProcessingContainer === container.id}
                                >
                                  {isProcessingContainer === container.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove Container</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Images */}
          {dockerStatus?.dockerRunning && dockerStatus.images.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HardDrive className="h-5 w-5 text-purple-600" />
                  Images
                  <Badge variant="secondary" className="ml-2">{dockerStatus.images.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dockerStatus.images.slice(0, 10).map((image) => (
                    <div key={image.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{image.repository || '<none>'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{image.tag || 'latest'}</Badge>
                          <span className="text-xs text-muted-foreground">{image.size}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{image.createdSince}</p>
                    </div>
                  ))}
                </div>
                {dockerStatus.images.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    And {dockerStatus.images.length - 10} more images...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Networks & Volumes */}
          {dockerStatus?.dockerRunning && (dockerStatus.networks.length > 0 || dockerStatus.volumes.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Networks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Network className="h-5 w-5 text-blue-600" />
                    Networks
                    <Badge variant="secondary" className="ml-2">{dockerStatus.networks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dockerStatus.networks.map((network) => (
                      <div key={network.id} className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                        <span className="font-medium text-sm">{network.name}</span>
                        <Badge variant="outline" className="text-xs">{network.driver}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Volumes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-orange-600" />
                    Volumes
                    <Badge variant="secondary" className="ml-2">{dockerStatus.volumes.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dockerStatus.volumes.slice(0, 5).map((volume) => (
                      <div key={volume.name} className="flex items-center justify-between p-2 bg-muted/30 rounded border">
                        <span className="font-medium text-sm truncate max-w-[200px]">{volume.name}</span>
                        <Badge variant="outline" className="text-xs">{volume.driver}</Badge>
                      </div>
                    ))}
                    {dockerStatus.volumes.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        And {dockerStatus.volumes.length - 5} more...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Container Logs Modal */}
          {containerLogs && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="h-5 w-5" />
                  Container Logs: {containerLogs.containerId.substring(0, 12)}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setContainerLogs(null)}>
                  Close
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] rounded-md border bg-black/90 p-4">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                    {containerLogs.logs || 'No logs available'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Installation Guide */}
          {showInstallGuide && dockerInstallGuide && (
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between bg-blue-50 dark:bg-blue-950/20">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-blue-600" />
                    Docker Installation Guide for {dockerInstallGuide.platform}
                  </CardTitle>
                  <CardDescription>
                    Recommended: {dockerInstallGuide.recommendedMethod}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowInstallGuide(false)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {dockerInstallGuide.steps.map((step) => (
                    <div key={step.order} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {step.order}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        {step.command && (
                          <div className="mt-2 flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-muted rounded font-mono text-xs break-all">
                              {step.command}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => copyToClipboard(step.command!)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {dockerInstallGuide.notes && (
                  <div className="mt-6 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <AlertCircle className="h-4 w-4 inline mr-2" />
                      {dockerInstallGuide.notes}
                    </p>
                  </div>
                )}
                
                {dockerInstallGuide.downloadUrl && (
                  <div className="mt-4 flex justify-center">
                    <Button asChild>
                      <a href={dockerInstallGuide.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Official Documentation
                      </a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Docker Error */}
          {dockerError && (
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span>{dockerError}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Container Logs Dialog */}
      <Dialog open={!!containerForLogs} onOpenChange={(open) => !open && setContainerForLogs(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Container Logs: {containerForLogs?.names}
            </DialogTitle>
            <DialogDescription>
              {containerForLogs?.image}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[600px] w-full rounded-md border bg-black p-4">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
              {containerLogs?.containerId === containerForLogs?.id 
                ? (containerLogs?.logs || 'Loading logs...')
                : 'Loading logs...'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Container Confirmation */}
      <AlertDialog open={!!containerToDelete} onOpenChange={(open) => !open && setContainerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Delete Container?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete container <strong>{containerToDelete?.names}</strong>?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">Image: {containerToDelete?.image}</span>
              <br />
              This action cannot be undone. The container will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (containerToDelete) {
                  handleDeleteContainer(containerToDelete.id!);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restart Container Confirmation */}
      <AlertDialog open={!!containerToRestart} onOpenChange={(open) => !open && setContainerToRestart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-blue-600" />
              {containerToRestart?.state === 'running' ? 'Restart' : 'Start'} Container?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {containerToRestart?.state === 'running' ? 'restart' : 'start'} container <strong>{containerToRestart?.names}</strong>?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">Image: {containerToRestart?.image}</span>
              {containerToRestart?.state === 'running' && (
                <><br />The container will be stopped and then started again.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (containerToRestart) {
                  handleRestartContainer(containerToRestart.id!, containerToRestart.state === 'running');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {containerToRestart?.state === 'running' ? 'Restart' : 'Start'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
