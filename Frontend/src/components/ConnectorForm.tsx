import { useState, useEffect } from 'react';
import { ArrowLeft, Save, HelpCircle, Database, FileJson, Camera, Clock, Zap, Shield, CheckCircle2, XCircle, RefreshCw, Info, BookOpen, ChevronDown, AlertCircle, AlertTriangle } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';

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
  additionalConfig?: string;
}

interface ConnectorFormProps {
  connector: Connector | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConnectorForm({ connector, onClose, onSuccess }: ConnectorFormProps) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [showGuide, setShowGuide] = useState(!connector);
  const [formData, setFormData] = useState<Connector>({
    name: '',
    connectorClass: 'io.debezium.connector.postgresql.PostgresConnector',
    databaseHostname: 'openradius-postgres',
    databasePort: 5432,
    databaseUser: 'admin',
    databasePassword: 'admin123',
    databaseName: 'openradius_workspace_1', // Default to workspace database
    databaseServerName: 'workspace_1',
    pluginName: 'pgoutput',
    slotName: '',
    publicationAutocreateMode: 'filtered',
    tableIncludeList: '',
    snapshotMode: 'initial',
    additionalConfig: '',
  });

  useEffect(() => {
    if (connector) {
      setFormData(connector);
      if (connector.tableIncludeList) {
        setSelectedTables(connector.tableIncludeList.split(',').map(t => t.trim()));
      }
    }
  }, [connector]);

  const handleChange = (field: keyof Connector, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Reset connection status when database fields change
    if (['databaseHostname', 'databasePort', 'databaseUser', 'databasePassword', 'databaseName'].includes(field)) {
      setConnectionStatus('unknown');
    }
  };

  const fetchTables = async () => {
    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/get-tables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectorClass: formData.connectorClass,
          databaseHostname: formData.databaseHostname,
          databasePort: formData.databasePort,
          databaseUser: formData.databaseUser,
          databasePassword: formData.databasePassword,
          databaseName: formData.databaseName,
        }),
      });

      const data = await response.json();
      if (response.ok && data.tables) {
        setAvailableTables(data.tables);
      } else {
        toast.error('Failed to fetch tables: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error('Failed to fetch tables from database');
    }
  };

  const testDatabaseConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus('unknown');

      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectorClass: formData.connectorClass,
          databaseHostname: formData.databaseHostname,
          databasePort: formData.databasePort,
          databaseUser: formData.databaseUser,
          databasePassword: formData.databasePassword,
          databaseName: formData.databaseName,
        }),
      });

      const result = await response.json();

      if (result.connected) {
        setConnectionStatus('connected');
        toast.success(result.message || 'Successfully connected to database');
        // Fetch available tables after successful connection
        await fetchTables();
      } else {
        setConnectionStatus('failed');
        toast.error(result.message || 'Failed to connect to database');
      }
    } catch (error: any) {
      setConnectionStatus('failed');
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Update tableIncludeList from selectedTables
    const updatedFormData = {
      ...formData,
      tableIncludeList: selectedTables.join(',')
    };

    try {
      // Auto-generate slot name if empty
      if (!updatedFormData.slotName) {
        // Generate slot name: only lowercase, digits, underscores, max 63 chars
        updatedFormData.slotName = updatedFormData.name
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .substring(0, 50) + '_slot';
      } else {
        // Validate slot name
        const slotName = updatedFormData.slotName.toLowerCase();
        if (slotName.length > 63) {
          toast.error('Slot name must be 63 characters or less');
          setLoading(false);
          return;
        }
        if (!/^[a-z0-9_]+$/.test(slotName)) {
          toast.error('Slot name must contain only lowercase letters, digits, and underscores');
          setLoading(false);
          return;
        }
        // Normalize the slot name
        updatedFormData.slotName = slotName;
      }

      const url = connector?.id
        ? `${appConfig.api.baseUrl}/api/debezium/connectors/${connector.name}`
        : `${appConfig.api.baseUrl}/api/debezium/connectors`;

      const response = await fetch(url, {
        method: connector?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save connector');
      }

      toast.success(`Connector ${connector?.id ? 'updated' : 'created'} successfully`);

      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save connector');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <CardTitle>{connector?.id ? 'Edit' : 'Create'} Connector</CardTitle>
              <CardDescription>
                Configure Debezium CDC connector for PostgreSQL database synchronization
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGuide(!showGuide)}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              {showGuide ? 'Hide' : 'Show'} Guide
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Workspace Database Info */}
          <Alert className="mb-4 bg-muted border">
            <Database className="h-4 w-4 text-primary" />
            <AlertTitle className="text-foreground font-semibold">Current Workspace Database</AlertTitle>
            <AlertDescription className="text-muted-foreground text-sm mt-2">
              <p>You are configuring a connector for: <code className="bg-primary/10 px-1 rounded font-mono font-semibold">openradius_workspace_1</code></p>
              <p className="mt-1 text-xs">
                ✓ Connector configuration is stored per workspace<br />
                ✓ Default database name pre-filled with current workspace<br />
                ✓ Each workspace has isolated connector settings
              </p>
            </AlertDescription>
          </Alert>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="name">Connector Name *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Unique identifier for this connector. Cannot be changed after creation. Use lowercase with hyphens (e.g., cloud-users-source)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., cloud-users-source"
                    required
                    disabled={!!connector?.id}
                  />
                  <p className="text-xs text-muted-foreground">
                    {connector?.id ? 'Cannot be changed after creation' : 'Use lowercase with hyphens for naming'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="connectorClass">Connector Class *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">The type of database you want to capture changes from. Each connector is optimized for its specific database.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.connectorClass}
                    onValueChange={(value) => handleChange('connectorClass', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="io.debezium.connector.postgresql.PostgresConnector">
                        <div className="flex items-center gap-2 w-full text-left">
                          <img src="/postgresql-icon.svg" alt="PostgreSQL" className="h-5 w-5" />
                          PostgreSQL
                        </div>
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mysql.MySqlConnector">
                        <div className="flex items-center gap-2 w-full text-left">
                          <img src="/mysql-icon.svg" alt="MySQL" className="h-5 w-5" />
                          MySQL
                        </div>
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mongodb.MongoDbConnector">
                        <div className="flex items-center gap-2 w-full text-left">
                          <img src="/mongodb-icon.svg" alt="MongoDB" className="h-5 w-5" />
                          MongoDB
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the database type for change data capture
                  </p>
                </div>
              </div>
            </div>

            {/* Database Connection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Source Database Connection</h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  Reading FROM this database →
                </Badge>
              </div>
              <Alert className="bg-primary/5 border-primary/30">
                <Database className="h-4 w-4 text-primary" />
                <AlertDescription className="text-muted-foreground text-sm">
                  <strong>Configure the database you want to capture changes FROM.</strong> This connector will monitor this database and stream changes to Kafka/Redpanda.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseHostname">Hostname *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">The hostname or IP address of your PostgreSQL database server. Use container name if running in Docker.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="databaseHostname"
                    value={formData.databaseHostname}
                    onChange={(e) => handleChange('databaseHostname', e.target.value)}
                    placeholder="e.g., postgres_local1, openradius-postgres, or 192.168.1.100"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>SOURCE database</strong> hostname - where data will be read FROM
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databasePort">Port *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">PostgreSQL default port is 5432. MySQL uses 3306, MongoDB uses 27017.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="databasePort"
                    type="number"
                    value={formData.databasePort}
                    onChange={(e) => handleChange('databasePort', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseUser">Username *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Database user must have REPLICATION and SELECT privileges on the tables you want to track.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="databaseUser"
                    value={formData.databaseUser}
                    onChange={(e) => handleChange('databaseUser', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="databasePassword">Password *</Label>
                  <Input
                    id="databasePassword"
                    type="password"
                    value={formData.databasePassword}
                    onChange={(e) => handleChange('databasePassword', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseName">Database Name *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">The name of the PostgreSQL database containing the tables you want to track.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="databaseName"
                    value={formData.databaseName}
                    onChange={(e) => handleChange('databaseName', e.target.value)}
                    placeholder="e.g., local1_db, openradius_workspace_1"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>SOURCE database</strong> name to read changes from
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseServerName">Server Name *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Logical name used as a prefix for Kafka topics. Should be unique across all connectors.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="databaseServerName"
                    value={formData.databaseServerName}
                    onChange={(e) => handleChange('databaseServerName', e.target.value)}
                    placeholder="Logical name for this server"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Used as Kafka topic prefix (e.g., openradius.public.users)
                  </p>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testDatabaseConnection}
                  disabled={testing || !formData.databaseHostname || !formData.databaseUser || !formData.databasePassword || !formData.databaseName}
                  className="flex items-center gap-2"
                >
                  {testing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : connectionStatus === 'connected' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : connectionStatus === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {testing ? 'Testing Connection...' : 'Test Database Connection'}
                </Button>
                {connectionStatus === 'connected' && (
                  <span className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Connection successful</span>
                )}
                {connectionStatus === 'failed' && (
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">✗ Connection failed</span>
                )}
              </div>
            </div>

            {/* CDC Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">CDC Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="pluginName">Plugin Name *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">The logical decoding output plugin installed in PostgreSQL. pgoutput is built-in and recommended for most use cases.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.pluginName}
                    onValueChange={(value) => handleChange('pluginName', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgoutput">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Shield className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">pgoutput</div>
                            <div className="text-xs text-muted-foreground">Built-in, no extra installation</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="decoderbufs">
                        <div className="flex items-center gap-2 w-full text-left">
                          <FileJson className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">decoderbufs</div>
                            <div className="text-xs text-muted-foreground">Protocol buffers format</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="wal2json">
                        <div className="flex items-center gap-2 w-full text-left">
                          <FileJson className="h-4 w-4 text-orange-600" />
                          <div>
                            <div className="font-medium">wal2json</div>
                            <div className="text-xs text-muted-foreground">JSON format output</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    PostgreSQL logical decoding plugin for WAL streaming
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="slotName">Replication Slot Name</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">A unique name for the PostgreSQL replication slot. Must contain only lowercase letters, digits, and underscores (max 63 chars). Auto-generated if left empty.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Alert className="bg-destructive/10 border-destructive/30 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive text-xs">
                      <strong>CRITICAL:</strong> Each connector MUST have a UNIQUE slot name. Reusing a slot name will cause "slot already exists" errors and connector failure.
                    </AlertDescription>
                  </Alert>
                  <Input
                    id="slotName"
                    value={formData.slotName}
                    onChange={(e) => {
                      // Auto-convert to lowercase and replace invalid chars
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                      handleChange('slotName', value);
                    }}
                    placeholder="Auto-generated if empty (Recommended)"
                    maxLength={63}
                  />
                  <p className="text-xs text-muted-foreground">
                    <strong>Naming convention:</strong> connector_name_slot or table_name_slot<br />
                    Only lowercase letters, digits, and underscores (max 63 chars)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="publicationAutocreateMode">Publication Mode *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Controls how PostgreSQL publications are created for tracking changes. Filtered mode only tracks specified tables.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.publicationAutocreateMode}
                    onValueChange={(value) => handleChange('publicationAutocreateMode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filtered">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <div>
                            <div className="font-medium">Filtered</div>
                            <div className="text-xs text-muted-foreground">Only specified tables (Recommended)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="all_tables">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Database className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">All Tables</div>
                            <div className="text-xs text-muted-foreground">Track all tables in the database</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="disabled">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Shield className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">Disabled</div>
                            <div className="text-xs text-muted-foreground">Use existing publication</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    How to create PostgreSQL publication for change tracking
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="snapshotMode">Snapshot Mode *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Controls when to take a snapshot of existing data. Initial mode snapshots once, then only tracks changes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.snapshotMode}
                    onValueChange={(value) => handleChange('snapshotMode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Camera className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">Initial</div>
                            <div className="text-xs text-muted-foreground">Snapshot on first run only (Recommended)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="always">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <div>
                            <div className="font-medium">Always</div>
                            <div className="text-xs text-muted-foreground">Snapshot every time connector starts</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="never">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Zap className="h-4 w-4 text-primary" />
                          <div>
                            <div className="font-medium">Never</div>
                            <div className="text-xs text-muted-foreground">Only track changes, no snapshot</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="exported">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <div>
                            <div className="font-medium">Exported</div>
                            <div className="text-xs text-muted-foreground">Use existing snapshot transaction</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When to capture existing data before streaming changes
                  </p>
                </div>

                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tableIncludeList">Table Include List *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Select tables to track changes from. Test database connection first to load available tables.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {availableTables.length > 0 ? (
                    <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          id="select-all"
                          checked={selectedTables.length === availableTables.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTables([...availableTables]);
                            } else {
                              setSelectedTables([]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="select-all" className="font-medium text-sm">
                          Select All ({availableTables.length} tables)
                        </label>
                      </div>
                      <div className="border-t pt-2">
                        {availableTables.map((table) => (
                          <div key={table} className="flex items-center gap-2 py-1">
                            <input
                              type="checkbox"
                              id={`table-${table}`}
                              checked={selectedTables.includes(table)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTables([...selectedTables, table]);
                                } else {
                                  setSelectedTables(selectedTables.filter(t => t !== table));
                                }
                              }}
                              className="rounded border-gray-300"
                            />
                            <label htmlFor={`table-${table}`} className="text-sm cursor-pointer">
                              {table}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
                      {connectionStatus === 'connected' 
                        ? 'Loading tables...' 
                        : 'Test database connection first to load available tables'}
                    </div>
                  )}
                  
                  {selectedTables.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Selected {selectedTables.length} table{selectedTables.length !== 1 ? 's' : ''}: {selectedTables.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Transforms Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Transforms (Optional)</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p>Transforms modify data as it flows through the connector. Common uses: adding fields, filtering, routing, format conversion.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Common Transform Examples</AlertTitle>
                <AlertDescription className="mt-2">
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="link" className="p-0 h-auto font-normal text-sm">
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Click to see transform examples
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-3 text-xs">
                      <div className="bg-muted p-3 rounded">
                        <strong className="block mb-2 text-foreground">1. Add Static Field (e.g., local_id or source identifier):</strong>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
{`{
  "transforms": "addLocalId",
  "transforms.addLocalId.type": "org.apache.kafka.connect.transforms.InsertField$Value",
  "transforms.addLocalId.static.field": "local_id",
  "transforms.addLocalId.static.value": "local1"
}`}
                        </pre>
                      </div>

                      <div className="bg-muted p-3 rounded">
                        <strong className="block mb-2 text-foreground">2. Route to Different Topics by Table:</strong>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
{`{
  "transforms": "route",
  "transforms.route.type": "org.apache.kafka.connect.transforms.RegexRouter",
  "transforms.route.regex": "([^.]+)\\.([^.]+)\\.([^.]+)",
  "transforms.route.replacement": "$3"
}`}
                        </pre>
                      </div>

                      <div className="bg-muted p-3 rounded">
                        <strong className="block mb-2 text-foreground">3. Multiple Transforms (Add field + Timestamp):</strong>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
{`{
  "transforms": "addSource,addTimestamp",
  "transforms.addSource.type": "org.apache.kafka.connect.transforms.InsertField$Value",
  "transforms.addSource.static.field": "source_db",
  "transforms.addSource.static.value": "workspace_1",
  "transforms.addTimestamp.type": "org.apache.kafka.connect.transforms.InsertField$Value",
  "transforms.addTimestamp.timestamp.field": "sync_timestamp"
}`}
                        </pre>
                      </div>

                      <div className="bg-muted p-3 rounded">
                        <strong className="block mb-2 text-foreground">4. Filter Records by Condition:</strong>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
{`{
  "transforms": "filter",
  "transforms.filter.type": "io.debezium.transforms.Filter",
  "transforms.filter.language": "jsr223.groovy",
  "transforms.filter.condition": "value.op == 'c' || value.op == 'u'"
}`}
                        </pre>
                      </div>

                      <div className="bg-muted p-3 rounded">
                        <strong className="block mb-2 text-foreground">5. Unwrap Debezium Envelope (Flatten structure):</strong>
                        <pre className="bg-background p-2 rounded overflow-x-auto">
{`{
  "transforms": "unwrap",
  "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
  "transforms.unwrap.drop.tombstones": "false",
  "transforms.unwrap.delete.handling.mode": "rewrite"
}`}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="additionalConfig">Transforms & Additional Config (JSON)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-md">
                        <p>Add transforms and other advanced configuration in JSON format. Copy one of the examples above and customize it for your needs.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <textarea
                  id="additionalConfig"
                  className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={formData.additionalConfig || ''}
                  onChange={(e) => handleChange('additionalConfig', e.target.value)}
                  placeholder={`Example - Add static field for multi-source tracking:
{
  "transforms": "addLocalId",
  "transforms.addLocalId.type": "org.apache.kafka.connect.transforms.InsertField$Value",
  "transforms.addLocalId.static.field": "local_id",
  "transforms.addLocalId.static.value": "local1"
}`}
                />
                <p className="text-xs text-muted-foreground">
                  Paste JSON configuration for transforms, predicates, and other advanced settings
                </p>
              </div>
            </div>

            {/* Full Configuration Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Configuration Preview</h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                  SOURCE Connector Config
                </Badge>
              </div>
              <Alert className="bg-primary/5 border-primary/30">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-muted-foreground text-xs">
                  This shows the configuration for the SOURCE connector that will READ data from the database you configured above. 
                  This is NOT the target/destination database - to write data to a target, you'll need a separate SINK connector.
                </AlertDescription>
              </Alert>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" type="button" className="w-full">
                    <ChevronDown className="h-4 w-4 mr-2" />
                    View Full Source Connector Configuration JSON
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground">Source Database: {formData.databaseHostname}/{formData.databaseName}</span>
                      <span className="text-xs text-muted-foreground">→ Kafka/Redpanda</span>
                    </div>
                    <pre className="text-xs overflow-x-auto">
{(() => {
  let additionalConfig = {};
  try {
    additionalConfig = formData.additionalConfig ? JSON.parse(formData.additionalConfig) : {};
  } catch (e) {
    additionalConfig = { _parseError: 'Invalid JSON in additional config' };
  }
  
  return JSON.stringify({
    name: formData.name || 'connector-name',
    config: {
      'connector.class': formData.connectorClass,
      'database.hostname': formData.databaseHostname,
      'database.port': formData.databasePort.toString(),
      'database.user': formData.databaseUser,
      'database.password': '***',
      'database.dbname': formData.databaseName,
      'database.server.name': formData.databaseServerName,
      'plugin.name': formData.pluginName,
      'slot.name': formData.slotName || `${formData.name}_slot`,
      'publication.autocreate.mode': formData.publicationAutocreateMode,
      'table.include.list': selectedTables.join(',') || formData.tableIncludeList,
      'snapshot.mode': formData.snapshotMode,
      ...additionalConfig
    }
  }, null, 2);
})()}
                    </pre>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Sink Connector Guide */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Target (Sink) Connector Setup</h3>
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                  Writing TO target database ←
                </Badge>
              </div>
              <Alert className="bg-green-500/10 border-green-500/30">
                <Database className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-foreground font-semibold mb-2">Complete the Data Flow</AlertTitle>
                <AlertDescription className="text-muted-foreground text-sm space-y-2">
                  <p>After creating this SOURCE connector, you need a SINK connector on the target system to write the Kafka data to a database.</p>
                  <div className="bg-green-500/10 p-2 rounded font-mono text-xs mt-2">
                    {formData.databaseHostname}/{formData.databaseName} → Kafka → SINK Connector → Target DB
                  </div>
                </AlertDescription>
              </Alert>
              
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" type="button" className="w-full">
                    <ChevronDown className="h-4 w-4 mr-2" />
                    View Example JDBC Sink Connector Configuration
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="space-y-3">
                    <Alert className="bg-yellow-500/10 border-yellow-500/30">
                      <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-muted-foreground text-xs">
                        <strong>Note:</strong> This sink connector must be created on your target system (not in OpenRadius). 
                        It connects to Kafka and writes data to your target database.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-xs font-semibold mb-2 text-muted-foreground">JDBC Sink Connector Example (to be created on target system):</p>
                      <pre className="text-xs overflow-x-auto">
{JSON.stringify({
  name: `${formData.name}-sink`,
  config: {
    'connector.class': 'io.confluent.connect.jdbc.JdbcSinkConnector',
    'connection.url': 'jdbc:postgresql://target-host:5432/target_database',
    'connection.user': 'target_user',
    'connection.password': 'target_password',
    'topics': selectedTables.map(table => `${formData.databaseServerName}.${table}`).join(',') || `${formData.databaseServerName}.public.table_name`,
    'auto.create': 'true',
    'auto.evolve': 'true',
    'insert.mode': 'upsert',
    'pk.mode': 'record_key',
    'table.name.format': '${topic}',
    'transforms': 'unwrap',
    'transforms.unwrap.type': 'io.debezium.transforms.ExtractNewRecordState',
    'transforms.unwrap.drop.tombstones': 'false'
  }
}, null, 2)}
                      </pre>
                    </div>
                    
                    <div className="bg-primary/5 p-3 rounded text-xs space-y-2">
                      <p className="font-semibold text-foreground">Key Configuration Points:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                        <li><strong>connection.url:</strong> JDBC URL to your TARGET database (where you want to write data)</li>
                        <li><strong>topics:</strong> Kafka topics created by this source connector ({selectedTables.length > 0 ? selectedTables.map(t => `${formData.databaseServerName}.${t}`).join(', ') : `${formData.databaseServerName}.public.*`})</li>
                        <li><strong>auto.create:</strong> Automatically creates tables in target database</li>
                        <li><strong>transforms.unwrap:</strong> Extracts actual data from Debezium envelope</li>
                      </ul>
                    </div>
                    
                    <div className="bg-muted p-3 rounded text-xs space-y-2">
                      <p className="font-semibold text-foreground">Alternative: Custom Application</p>
                      <p className="text-muted-foreground">Instead of a JDBC Sink Connector, you can build a custom application that:</p>
                      <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                        <li>Consumes from Kafka topics: <code className="bg-primary/10 px-1 rounded">{formData.databaseServerName}.public.*</code></li>
                        <li>Processes/transforms the data as needed</li>
                        <li>Writes to your target database or API</li>
                        <li>Useful when you need custom business logic during sync</li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : connector?.id ? 'Update Connector' : 'Create Connector'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
