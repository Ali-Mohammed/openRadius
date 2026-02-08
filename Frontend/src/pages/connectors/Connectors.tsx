import React, { useState, useEffect } from 'react';
import { Plus, Play, Pause, RefreshCw, Trash2, Edit, AlertCircle, Info, ChevronDown, ChevronRight, Activity, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ConnectorForm from '@/components/ConnectorForm';

interface Connector {
  id?: number;
  name: string;
  connectorClass: string;
  databaseHostname: string;
  databasePort: number;
  databaseUser: string;
  databasePassword: string;
  databaseName: string;
  databaseServerName: string;
  pluginName: string;
  slotName: string;
  publicationAutocreateMode: string;
  tableIncludeList: string;
  snapshotMode: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function Connectors() {
  const [connectors, setConnectors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; connectorName: string | null }>({ open: false, connectorName: null });

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      
      // First, sync connectors from Debezium to database
      try {
        await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (syncError) {
        console.warn('Failed to sync connectors:', syncError);
        // Continue even if sync fails
      }
      
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors`);
      if (!response.ok) throw new Error('Failed to fetch connectors');
      
      const data = await response.json();
      
      // Merge Debezium and database connectors
      const mergedConnectors: any[] = [];
      
      if (data.debezium) {
        Object.entries(data.debezium).forEach(([name, info]: [string, any]) => {
          const dbConnector = data.database?.find((c: Connector) => c.name === name);
          
          // Try to get config from multiple possible locations
          let config = info.info?.config || info.config || {};
          
          // If config is empty but we have database connector, use its data
          if (Object.keys(config).length === 0 && dbConnector) {
            config = {
              'connector.class': dbConnector.connectorClass,
              'database.hostname': dbConnector.databaseHostname,
              'database.port': dbConnector.databasePort?.toString(),
              'database.user': dbConnector.databaseUser,
              'database.dbname': dbConnector.databaseName,
              'database.server.name': dbConnector.databaseServerName,
              'plugin.name': dbConnector.pluginName,
              'slot.name': dbConnector.slotName,
              'publication.autocreate.mode': dbConnector.publicationAutocreateMode,
              'table.include.list': dbConnector.tableIncludeList,
              'snapshot.mode': dbConnector.snapshotMode,
            };
          }
          
          mergedConnectors.push({
            name,
            status: info.status?.connector?.state || 'UNKNOWN',
            type: info.info?.type || info.type || 'source',
            config: config,
            tasks: info.status?.tasks || [],
            database: dbConnector
          });
        });
      }
      
      // Add any database-only connectors
      if (data.database) {
        data.database.forEach((dbConnector: Connector) => {
          if (!mergedConnectors.find(c => c.name === dbConnector.name)) {
            mergedConnectors.push({
              name: dbConnector.name,
              status: dbConnector.status || 'UNASSIGNED',
              type: 'source',
              config: {},
              tasks: [],
              database: dbConnector
            });
          }
        });
      }
      
      setConnectors(mergedConnectors);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch connectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const openDeleteDialog = (name: string) => {
    setDeleteDialog({ open: true, connectorName: name });
  };

  const handleDelete = async () => {
    if (!deleteDialog.connectorName) return;

    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/${deleteDialog.connectorName}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete connector');

      toast.success('Connector deleted successfully');
      setDeleteDialog({ open: false, connectorName: null });

      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete connector');
      setDeleteDialog({ open: false, connectorName: null });
    }
  };

  const handlePause = async (name: string) => {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/${name}/pause`, {
        method: 'PUT',
      });

      if (!response.ok) throw new Error('Failed to pause connector');

      toast.success('Connector paused successfully');

      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to pause connector');
    }
  };

  const handleResume = async (name: string) => {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/${name}/resume`, {
        method: 'PUT',
      });

      if (!response.ok) throw new Error('Failed to resume connector');

      toast.success('Connector resumed successfully');

      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to resume connector');
    }
  };

  const handleRestart = async (name: string) => {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/${name}/restart`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to restart connector');

      toast.success('Connector restarted successfully');

      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to restart connector');
    }
  };

  const handleEdit = (connector: any) => {
    setEditingConnector(connector.database || {
      name: connector.name,
      connectorClass: connector.config['connector.class'] || 'io.debezium.connector.postgresql.PostgresConnector',
      databaseHostname: connector.config['database.hostname'] || '',
      databasePort: parseInt(connector.config['database.port']) || 5432,
      databaseUser: connector.config['database.user'] || '',
      databasePassword: connector.config['database.password'] || '',
      databaseName: connector.config['database.dbname'] || '',
      databaseServerName: connector.config['database.server.name'] || '',
      pluginName: connector.config['plugin.name'] || 'pgoutput',
      slotName: connector.config['slot.name'] || '',
      publicationAutocreateMode: connector.config['publication.autocreate.mode'] || 'filtered',
      tableIncludeList: connector.config['table.include.list'] || '',
      snapshotMode: connector.config['snapshot.mode'] || 'initial',
    });
    setShowForm(true);
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      RUNNING: 'bg-green-500',
      PAUSED: 'bg-yellow-500',
      FAILED: 'bg-red-500',
      UNASSIGNED: 'bg-gray-500',
    };

    return (
      <Badge className={statusColors[status] || 'bg-gray-500'}>
        {status}
      </Badge>
    );
  };

  if (showForm) {
    return (
      <ConnectorForm
        connector={editingConnector}
        onClose={() => {
          setShowForm(false);
          setEditingConnector(null);
        }}
        onSuccess={() => {
          setShowForm(false);
          setEditingConnector(null);
          fetchConnectors();
        }}
      />
    );
  }

  return (
    <div className="p-6">
      {showInfoBanner && (
        <Collapsible className="mb-6">
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <AlertTitle className="text-foreground font-semibold">About Debezium Connectors & Change Data Capture (CDC)</AlertTitle>
                    <AlertDescription className="text-muted-foreground mt-1">
                      Connectors capture and stream real-time database changes to sync data between systems.
                    </AlertDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInfoBanner(false)}
                  className="text-primary hover:text-primary/80"
                >
                  Dismiss
                </Button>
              </div>
            </CardHeader>
            <CollapsibleTrigger asChild>
              <div className="px-6 pb-3">
                <Button variant="link" className="text-primary p-0 h-auto font-normal">
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Learn more about creating connectors
                </Button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">🎯 What is a Connector?</h4>
                  <p className="text-muted-foreground mb-2">
                    A Debezium connector monitors a PostgreSQL database for changes (inserts, updates, deletes) 
                    and streams them in real-time to Kafka/Redpanda. <strong>This is a SOURCE connector - it READS from the database you configure.</strong>
                  </p>
                  <div className="bg-muted p-2 rounded font-mono text-xs text-foreground">
                    Source DB (configured below) → Debezium → Kafka → [Sink Connector] → Target System
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">📦 Common Use Cases:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li><strong>Export FROM OpenRadius:</strong> Configure connector to read from openradius_workspace_X, then use a sink connector to write to target DB</li>
                    <li><strong>Import TO OpenRadius:</strong> Configure connector to read from external database, process Kafka stream in OpenRadius</li>
                    <li><strong>Real-time Sync:</strong> Keep external dashboards or systems updated with live changes from your database</li>
                    <li><strong>Event Streaming:</strong> Trigger workflows when database records change</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">🚀 Quick Start - Creating Your First Connector:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Decide data flow direction:</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>Export FROM OpenRadius? → Configure connector to read from openradius-postgres</li>
                        <li>Import FROM external DB? → Configure connector to read from external hostname</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Click "Add Connector"</strong> button above
                    </li>
                    <li>
                      <strong>Name it:</strong> Use descriptive name like "workspace-1-export" or "external-db-import"
                    </li>
                    <li>
                      <strong>Configure SOURCE Database (where to READ from):</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>For OpenRadius export: <code className="bg-muted px-1 rounded">openradius-postgres</code>, DB: <code className="bg-muted px-1 rounded">openradius_workspace_1</code></li>
                        <li>For external import: Use external hostname/IP and database name</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Test Connection:</strong> Click "Test Database Connection" to verify
                    </li>
                    <li>
                      <strong>Select Tables:</strong> Choose which tables to track changes from
                    </li>
                    <li>
                      <strong>Choose Snapshot Mode:</strong>
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li><code className="bg-muted px-1 rounded">initial</code> - Captures existing data once, then streams changes</li>
                        <li><code className="bg-muted px-1 rounded">never</code> - Only captures future changes</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Click "Create Connector"</strong> and monitor the status
                    </li>
                  </ol>
                </div>

                <div className="border-t border-border pt-3 mt-3">
                  <h4 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    ⚠️ Common Error: "Replication slot already exists"
                  </h4>
                  <div className="bg-destructive/10 border border-destructive/30 p-3 rounded">
                    <p className="text-destructive font-semibold mb-2">Error Message:</p>
                    <code className="text-xs bg-destructive/15 p-2 block rounded text-destructive">
                      ERROR: replication slot "slot_name" already exists
                    </code>
                    <p className="text-muted-foreground mt-3"><strong>Cause:</strong> Each connector requires a UNIQUE replication slot name. You cannot reuse slot names across connectors.</p>
                    <p className="text-muted-foreground mt-2"><strong>Solutions:</strong></p>
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-muted-foreground">
                      <li><strong>Leave slot name empty</strong> when creating connector - it will auto-generate a unique slot name</li>
                      <li><strong>Use a different slot name</strong> - example: connector1_slot, connector2_slot, users_export_slot</li>
                      <li><strong>Delete the old connector first</strong> if replacing an existing one (deleting removes its replication slot)</li>
                      <li><strong>Manual cleanup (advanced):</strong> Connect to PostgreSQL and run <code className="bg-muted px-1 rounded">SELECT pg_drop_replication_slot('slot_name');</code></li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <h4 className="font-semibold text-foreground mb-2">💡 Pro Tips:</h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Start with one workspace database to test your configuration</li>
                    <li>Use meaningful server names (database.server.name) as they become Kafka topic prefixes</li>
                    <li>Monitor connector status - it should show "RUNNING" when active</li>
                    <li>Check task count to ensure workers are processing changes</li>
                    <li>Use filtered publication mode to only track selected tables (more efficient)</li>
                    <li><strong>Add transforms</strong> to include source identifiers (e.g., local_id) when syncing multiple databases</li>
                  </ul>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Debezium Connectors</CardTitle>
              <CardDescription>
                Manage Change Data Capture (CDC) connectors for database synchronization
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Alert className="bg-muted border py-2 px-3">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-muted-foreground text-xs ml-2">
                  <strong>Current Workspace Database:</strong> <code className="bg-primary/10 px-1 rounded font-mono">openradius_workspace_1</code>
                  <br />
                  <span className="text-muted-foreground">Connectors are stored per workspace</span>
                </AlertDescription>
              </Alert>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connector
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No connectors configured</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Create your first CDC connector to start streaming database changes in real-time.
              </p>
              <div className="bg-muted rounded-lg p-4 max-w-2xl mx-auto text-left mb-6">
                <h4 className="font-semibold text-foreground mb-3">Getting Started Checklist:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">1.</span>
                    <span><strong>Ensure your database is accessible:</strong> The PostgreSQL database must have logical replication enabled (<code className="bg-muted px-1 rounded">wal_level=logical</code>)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">2.</span>
                    <span><strong>Know your workspace database name:</strong> OpenRadius uses <code className="bg-muted px-1 rounded">openradius_workspace_1</code>, <code className="bg-muted px-1 rounded">openradius_workspace_2</code>, etc.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">3.</span>
                    <span><strong>Verify Debezium Connect is running:</strong> Check Settings → Debezium Settings to configure the Connect server URL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">4.</span>
                    <span><strong>Click "Add Connector" above</strong> and follow the guided form to create your first connector</span>
                  </li>
                </ul>
              </div>
              <Button onClick={() => setShowForm(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Connector
              </Button>
            </div>
          ) : (
            <div className="border rounded-md overflow-auto" style={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-10 px-3 w-[50px]"></TableHead>
                    <TableHead className="h-10 px-3 w-[200px]">Name</TableHead>
                    <TableHead className="h-10 px-3 w-[150px]">Type</TableHead>
                    <TableHead className="h-10 px-3 w-[120px]">Status</TableHead>
                    <TableHead className="h-10 px-3 w-[350px]">Database</TableHead>
                    <TableHead className="h-10 px-3 w-[250px]">Tables</TableHead>
                    <TableHead className="h-10 px-3 w-[120px]">Tasks</TableHead>
                    <TableHead className="h-10 px-3 w-[150px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <React.Fragment key={connector.name}>
                    <TableRow className="hover:bg-muted/50">
                      <TableCell className="h-10 px-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setExpandedConnector(expandedConnector === connector.name ? null : connector.name)}
                        >
                          {expandedConnector === connector.name ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="h-10 px-3 font-semibold">{connector.name}</TableCell>
                      <TableCell className="h-10 px-3 text-sm">{connector.type}</TableCell>
                      <TableCell className="h-10 px-3">{getStatusBadge(connector.status)}</TableCell>
                      <TableCell className="h-10 px-3">
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium">
                            {connector.config['database.hostname'] || connector.database?.databaseHostname || '-'}:{connector.config['database.port'] || connector.database?.databasePort || '-'}
                          </div>
                          <div className="text-muted-foreground">
                            {connector.config['database.dbname'] || connector.database?.databaseName || '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3">
                        <div className="text-xs text-muted-foreground truncate" title={connector.config['table.include.list'] || connector.database?.tableIncludeList || '-'}>
                          {connector.config['table.include.list'] || connector.database?.tableIncludeList || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3">
                        <div className="flex items-center gap-2">
                          <span>{connector.tasks?.length || 0} task(s)</span>
                          {connector.tasks && connector.tasks.length > 0 && (
                            <div className="flex items-center gap-1">
                              {connector.tasks.filter((t: any) => t.state === 'RUNNING').length > 0 && (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              )}
                              {connector.tasks.filter((t: any) => t.state === 'FAILED').length > 0 && (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="h-10 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {connector.status === 'RUNNING' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePause(connector.name)}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResume(connector.name)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestart(connector.name)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(connector)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(connector.name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>                    
                    {/* Expanded Details Row */}
                    {expandedConnector === connector.name && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30 p-6">
                          <div className="space-y-6">
                            {/* Connector Information */}
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Connector Information
                              </h4>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Connector Class</p>
                                  <p className="font-mono text-xs">{connector.config['connector.class'] || 'N/A'}</p>
                                </div>
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Database Server</p>
                                  <p className="font-medium">{connector.config['database.server.name'] || 'N/A'}</p>
                                </div>
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Snapshot Mode</p>
                                  <p className="font-medium">{connector.config['snapshot.mode'] || 'N/A'}</p>
                                </div>
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Plugin</p>
                                  <p className="font-medium">{connector.config['plugin.name'] || 'N/A'}</p>
                                </div>
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Slot Name</p>
                                  <p className="font-mono text-xs">{connector.config['slot.name'] || 'N/A'}</p>
                                </div>
                                <div className="bg-background p-3 rounded">
                                  <p className="text-muted-foreground text-xs mb-1">Publication Mode</p>
                                  <p className="font-medium">{connector.config['publication.autocreate.mode'] || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                            {/* Task Status */}
                            {connector.tasks && connector.tasks.length > 0 && (
                              <div>
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  Task Status ({connector.tasks.length})
                                </h4>
                                <div className="space-y-2">
                                  {connector.tasks.map((task: any, idx: number) => (
                                    <div key={idx} className="bg-background p-4 rounded border">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <span className="font-semibold">
                                            Task ID: {typeof task.id === 'number' ? task.id : idx}
                                          </span>
                                          <span className="text-xs text-muted-foreground">(ID number, not update count)</span>
                                          <Badge className={
                                            task.state === 'RUNNING' ? 'bg-green-500' :
                                            task.state === 'FAILED' ? 'bg-red-500' :
                                            task.state === 'PAUSED' ? 'bg-yellow-500' :
                                            'bg-gray-500'
                                          }>
                                            {task.state || 'UNKNOWN'}
                                          </Badge>
                                          {task.state === 'RUNNING' && (
                                            <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                                              <Activity className="h-3 w-3 animate-pulse" />
                                              <span>Capturing Changes</span>
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          Worker: {task.worker_id || 'N/A'}
                                        </span>
                                      </div>

                                      {/* Activity Information */}
                                      {task.state === 'RUNNING' && (
                                        <div className="mb-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                                          <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            <span className="text-sm font-semibold text-green-900 dark:text-green-300">✅ Task is ACTIVELY capturing database changes</span>
                                          </div>
                                          <p className="text-xs text-green-800 dark:text-green-300/80 mb-2">
                                            <strong>Your updates ARE being captured!</strong> Any INSERT, UPDATE, or DELETE operations 
                                            on these tables are being streamed to Kafka in real-time.
                                          </p>
                                          <p className="text-xs text-green-800 dark:text-green-300/80">
                                            Monitored tables: <span className="font-mono font-semibold">
                                              {connector.config['table.include.list'] || 
                                               connector.database?.tableIncludeList || 
                                               'all tables in database'}
                                            </span>
                                          </p>
                                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-start gap-1 text-green-700 dark:text-green-400">
                                              <Activity className="h-3 w-3 mt-0.5 shrink-0" />
                                              <span>Streaming from: <strong className="font-semibold">
                                                {connector.config['database.dbname'] || 
                                                 connector.database?.databaseName || 
                                                 connector.config['database.hostname'] || 
                                                 'N/A'}
                                              </strong></span>
                                            </div>
                                            <div className="flex items-start gap-1 text-green-700 dark:text-green-400">
                                              <Activity className="h-3 w-3 mt-0.5 shrink-0" />
                                              <span>Topic prefix: <strong className="font-semibold">
                                                {connector.config['database.server.name'] || 
                                                 connector.database?.databaseServerName || 
                                                 'N/A'}
                                              </strong></span>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Instructions for testing */}
                                      {task.state === 'RUNNING' && idx === 0 && (
                                        <Alert className="mt-2 bg-primary/5 border-primary/30">
                                          <Info className="h-4 w-4 text-primary" />
                                          <AlertTitle className="text-foreground text-sm">Testing Change Capture</AlertTitle>
                                          <AlertDescription className="text-muted-foreground text-xs space-y-2">
                                            <p>To verify this connector is working:</p>
                                            <ol className="list-decimal list-inside space-y-1 ml-2">
                                              <li>Make a change to the <code className="bg-muted px-1 rounded font-semibold">
                                                {connector.config['database.dbname'] || connector.database?.databaseName || 'database'}
                                              </code> database (INSERT/UPDATE/DELETE)</li>
                                              <li>Check Kafka/Redpanda topics for new messages: <code className="bg-muted px-1 rounded font-semibold">
                                                {connector.config['database.server.name'] || connector.database?.databaseServerName || 'topic'}.public.*
                                              </code></li>
                                              <li>Or monitor connector logs for activity</li>
                                            </ol>
                                            {(connector.config['table.include.list'] || connector.database?.tableIncludeList) && (
                                              <p className="mt-2 font-semibold">
                                                Monitored topics: 
                                                {(connector.config['table.include.list'] || connector.database?.tableIncludeList || '')
                                                  .split(',')
                                                  .filter((t: string) => t.trim())
                                                  .map((table: string) => (
                                                    <code key={table} className="bg-muted px-1 rounded ml-1 inline-block mb-1">
                                                      {connector.config['database.server.name'] || connector.database?.databaseServerName}.{table.trim()}
                                                    </code>
                                                  ))
                                                }
                                              </p>
                                            )}
                                          </AlertDescription>
                                        </Alert>
                                      )}
                                      
                                      {task.trace && (
                                        <Alert className="mt-2 bg-destructive/10 border-destructive/30">
                                          <AlertTriangle className="h-4 w-4 text-destructive" />
                                          <AlertTitle className="text-destructive text-sm">Error Details</AlertTitle>
                                          <AlertDescription className="text-destructive/80 text-xs font-mono mt-1 max-h-32 overflow-auto">
                                            {task.trace}
                                          </AlertDescription>
                                        </Alert>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Configuration Details */}
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full">
                                  <ChevronDown className="h-4 w-4 mr-2" />
                                  View Full Configuration
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-3">
                                <div className="space-y-3">
                                  <div className="bg-background p-4 rounded border">
                                    <p className="text-xs font-semibold mb-2 text-muted-foreground">Connector Configuration:</p>
                                    <pre className="text-xs overflow-auto max-h-96">
                                      {JSON.stringify(connector.config, null, 2)}
                                    </pre>
                                  </div>
                                  
                                  {connector.database && (
                                    <div className="bg-background p-4 rounded border">
                                      <p className="text-xs font-semibold mb-2 text-muted-foreground">Database Record:</p>
                                      <pre className="text-xs overflow-auto max-h-96">
                                        {JSON.stringify(connector.database, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  <Alert className="bg-primary/5 border-primary/30">
                                    <Info className="h-4 w-4 text-primary" />
                                    <AlertDescription className="text-muted-foreground text-xs">
                                      <strong>Troubleshooting:</strong> If configuration shows empty values, the connector may not be properly registered in Debezium Connect. 
                                      Try restarting the connector or checking Debezium Connect logs at <code className="bg-muted px-1 rounded">http://localhost:8083</code>
                                    </AlertDescription>
                                  </Alert>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, connectorName: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Connector
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to delete the connector <strong className="text-foreground">"{deleteDialog.connectorName}"</strong>?
              </p>
              <div className="bg-destructive/10 border border-destructive/30 rounded p-3 space-y-2">
                <p className="font-semibold text-destructive text-sm">This action will:</p>
                <ul className="list-disc list-inside text-destructive/80 text-sm space-y-1">
                  <li>Stop the connector immediately</li>
                  <li>Remove the replication slot from PostgreSQL</li>
                  <li>Delete the connector configuration</li>
                  <li>Stop streaming changes to Kafka/Redpanda</li>
                </ul>
              </div>
              <p className="text-sm font-semibold text-red-600">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
            >
              Delete Connector
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
