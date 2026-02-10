import { useState, useEffect, useRef } from 'react';
import { Activity, Pause, Play, Trash2, RefreshCw, Database, AlertCircle, Info, Clock, User, Edit3, X } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { apiClient } from '@/lib/api';
import * as signalR from '@microsoft/signalr';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface CdcEvent {
  id: string;
  timestamp: number;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'READ';
  topic: string;
  table: string;
  before: any;
  after: any;
  source: {
    version: string;
    connector: string;
    name: string;
    ts_ms: number;
    snapshot: string;
    db: string;
    schema: string;
    table: string;
  };
}

// Fetch topics function
const fetchTopics = async (): Promise<string[]> => {
  const { data } = await apiClient.get('/api/cdc/topics');
  
  // Handle both {topics: []} and direct array responses
  return Array.isArray(data) ? data : (Array.isArray(data.topics) ? data.topics : []);
};

export default function CdcMonitor() {
  const [events, setEvents] = useState<CdcEvent[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [maxEvents, setMaxEvents] = useState(100);
  const scrollRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  // Use React Query to fetch topics
  const { data: availableTopics = [], isLoading: isLoadingTopics, error: topicsError } = useQuery({
    queryKey: ['cdc-topics'],
    queryFn: fetchTopics,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
  });

  // Show toast when topics are loaded or if there's an error
  useEffect(() => {
    if (topicsError) {
      toast.error('Backend not responding. Please start the backend server.');
    } else if (!isLoadingTopics && availableTopics.length === 0) {
      toast.info('No topics available. Create Debezium connectors to start monitoring.');
    }
  }, [availableTopics, isLoadingTopics, topicsError]);

  // Initialize SignalR connection
  useEffect(() => {
    let isMounted = true;
    let connection: signalR.HubConnection | null = null;
    
    const initializeConnection = async () => {
      // Small delay to avoid race condition in React StrictMode
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isMounted) return;
      
      connection = new signalR.HubConnectionBuilder()
        .withUrl(`${appConfig.api.baseUrl}/hubs/cdc`)
        .withAutomaticReconnect()
        .build();

      connection.on('ReceiveCdcEvent', (event: CdcEvent) => {
        setEvents((prev) => {
          const updated = [event, ...prev];
          return updated.slice(0, maxEvents);
        });
      });

      connection.on('Subscribed', (topic: string) => {
        toast.success(`Subscribed to ${topic}`);
      });

      connection.on('Unsubscribed', (topic: string) => {
        toast.success(`Unsubscribed from ${topic}`);
      });

      connectionRef.current = connection;

      try {
        if (isMounted && connection.state === signalR.HubConnectionState.Disconnected) {
          await connection.start();
          console.log('SignalR connected');
        }
      } catch (err) {
        if (isMounted) {
          console.error('SignalR connection error:', err);
        }
      }
    };

    initializeConnection();

    return () => {
      isMounted = false;
      if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
        connection.stop().catch(console.error);
      }
    };
  }, [maxEvents]);

  // Start monitoring a topic
  const startMonitoring = async () => {
    if (!selectedTopic) {
      toast.error('Please select a topic to monitor');
      return;
    }

    if (!connectionRef.current) {
      toast.error('SignalR connection not established');
      return;
    }

    try {
      await connectionRef.current.invoke('SubscribeToTopic', selectedTopic);
      setIsMonitoring(true);
      setEvents([]);
      toast.success(`Started monitoring ${selectedTopic}`);
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      toast.error('Failed to start monitoring');
    }
  };

  // Stop monitoring
  const stopMonitoring = async () => {
    if (!connectionRef.current || !selectedTopic) {
      return;
    }

    try {
      await connectionRef.current.invoke('UnsubscribeFromTopic', selectedTopic);
      setIsMonitoring(false);
      toast.success(`Stopped monitoring ${selectedTopic}`);
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      toast.error('Failed to stop monitoring');
    }
  };

  // Clear all events
  const clearEvents = () => {
    setEvents([]);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current && selectedTopic && isMonitoring) {
        connectionRef.current.invoke('UnsubscribeFromTopic', selectedTopic).catch(console.error);
      }
    };
  }, [selectedTopic, isMonitoring]);

  // Auto-scroll to latest event
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  const getOperationBadge = (operation: string) => {
    const colors: Record<string, string> = {
      INSERT: 'bg-green-500',
      UPDATE: 'bg-blue-500',
      DELETE: 'bg-red-500',
      READ: 'bg-gray-500',
    };

    const icons: Record<string, any> = {
      INSERT: <Database className="h-3 w-3" />,
      UPDATE: <Edit3 className="h-3 w-3" />,
      DELETE: <Trash2 className="h-3 w-3" />,
      READ: <Activity className="h-3 w-3" />,
    };

    return (
      <Badge className={`${colors[operation]} text-white flex items-center gap-1`}>
        {icons[operation]}
        {operation}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CDC Event Monitor</h1>
          <p className="text-muted-foreground mt-1">
            Monitor real-time change data capture events from Kafka/Redpanda topics
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          <Activity className="h-4 w-4 mr-2" />
          {events.length} Events
        </Badge>
      </div>

      {/* Info Banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900">About CDC Monitoring</AlertTitle>
        <AlertDescription className="text-blue-800 text-sm mt-2">
          This page displays real-time database change events captured by Debezium connectors. 
          Select a Kafka topic to monitor INSERT, UPDATE, and DELETE operations on your database tables.
        </AlertDescription>
      </Alert>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Controls</CardTitle>
          <CardDescription>Select a topic and start monitoring change events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Topic</label>
              <Select value={selectedTopic} onValueChange={setSelectedTopic} disabled={isMonitoring}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a Kafka topic..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTopics.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No topics available
                    </SelectItem>
                  ) : (
                    availableTopics.map((topic) => (
                      <SelectItem key={topic} value={topic}>
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          {topic}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Topics follow the pattern: {'{server}.{schema}.{table}'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Events</label>
              <Select 
                value={maxEvents.toString()} 
                onValueChange={(val) => setMaxEvents(parseInt(val))}
                disabled={isMonitoring}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 events</SelectItem>
                  <SelectItem value="100">100 events</SelectItem>
                  <SelectItem value="200">200 events</SelectItem>
                  <SelectItem value="500">500 events</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum events to keep in memory
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2">
                {!isMonitoring ? (
                  <Button onClick={startMonitoring} disabled={!selectedTopic} className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </Button>
                ) : (
                  <Button onClick={stopMonitoring} variant="destructive" className="flex-1">
                    <Pause className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}
                <Button onClick={clearEvents} variant="outline" disabled={events.length === 0}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoScroll"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoScroll" className="text-xs text-muted-foreground cursor-pointer">
                  Auto-scroll to latest
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live Event Stream</CardTitle>
              <CardDescription>
                {isMonitoring ? (
                  <span className="flex items-center gap-2 text-green-600">
                    <Activity className="h-4 w-4 animate-pulse" />
                    Monitoring {selectedTopic}
                  </span>
                ) : (
                  'Not monitoring - select a topic and click Start'
                )}
              </CardDescription>
            </div>
            {isMonitoring && (
              <Badge className="bg-green-500 text-white animate-pulse">
                <Activity className="h-3 w-3 mr-1" />
                LIVE
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No events captured yet</p>
              <p className="text-sm mt-1">
                {isMonitoring ? 'Waiting for database changes...' : 'Start monitoring to see events'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]" ref={scrollRef}>
              <div className="space-y-3">
                {events.map((event) => (
                  <Card key={event.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getOperationBadge(event.operation)}
                          <div>
                            <p className="font-semibold text-sm">{event.table}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(event.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {event.source.connector}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {event.before && (
                          <div>
                            <p className="text-xs font-semibold text-red-600 mb-1">BEFORE</p>
                            <pre className="text-xs bg-red-50 p-2 rounded overflow-auto max-h-48">
                              {JSON.stringify(event.before, null, 2)}
                            </pre>
                          </div>
                        )}
                        {event.after && (
                          <div>
                            <p className="text-xs font-semibold text-green-600 mb-1">AFTER</p>
                            <pre className="text-xs bg-green-50 p-2 rounded overflow-auto max-h-48">
                              {JSON.stringify(event.after, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          View metadata
                        </summary>
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                          {JSON.stringify(event.source, null, 2)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['INSERT', 'UPDATE', 'DELETE', 'READ'].map((op) => {
                const count = events.filter((e) => e.operation === op).length;
                return (
                  <div key={op} className="text-center p-4 bg-muted rounded">
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{op}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
