import { useState, useEffect } from 'react';
import { ArrowLeft, Save, HelpCircle, Database, FileJson, Camera, Clock, Zap, Shield, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { appConfig } from '@/config/app.config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [formData, setFormData] = useState<Connector>({
    name: '',
    connectorClass: 'io.debezium.connector.postgresql.PostgresConnector',
    databaseHostname: 'openradius-postgres',
    databasePort: 5432,
    databaseUser: 'admin',
    databasePassword: 'admin123',
    databaseName: 'openradius',
    databaseServerName: 'openradius',
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
        updatedFormData.slotName = `${updatedFormData.name.replace(/-/g, '_')}_slot`;
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
            <div>
              <CardTitle>{connector?.id ? 'Edit' : 'Create'} Connector</CardTitle>
              <CardDescription>
                Configure Debezium CDC connector for PostgreSQL database synchronization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
              <h3 className="text-lg font-semibold">Database Connection</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseHostname">Hostname *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                    placeholder="localhost or openradius-postgres"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Use Docker service name for containerized databases
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databasePort">Port *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                    placeholder="e.g., openradius"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="databaseServerName">Server Name *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : connectionStatus === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {testing ? 'Testing Connection...' : 'Test Database Connection'}
                </Button>
                {connectionStatus === 'connected' && (
                  <span className="text-sm text-green-600 font-medium">✓ Connection successful</span>
                )}
                {connectionStatus === 'failed' && (
                  <span className="text-sm text-red-600 font-medium">✗ Connection failed</span>
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <Shield className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">pgoutput</div>
                            <div className="text-xs text-muted-foreground">Built-in, no extra installation</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="decoderbufs">
                        <div className="flex items-center gap-2 w-full text-left">
                          <FileJson className="h-4 w-4 text-purple-600" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">A unique name for the PostgreSQL replication slot. PostgreSQL keeps track of changes using this slot. Auto-generated if left empty.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="slotName"
                    value={formData.slotName}
                    onChange={(e) => handleChange('slotName', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to auto-generate based on connector name
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="publicationAutocreateMode">Publication Mode *</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <Zap className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium">Filtered</div>
                            <div className="text-xs text-muted-foreground">Only specified tables (Recommended)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="all_tables">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Database className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">All Tables</div>
                            <div className="text-xs text-muted-foreground">Track all tables in the database</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="disabled">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Shield className="h-4 w-4 text-gray-600" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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
                          <Camera className="h-4 w-4 text-blue-600" />
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
                          <Zap className="h-4 w-4 text-purple-600" />
                          <div>
                            <div className="font-medium">Never</div>
                            <div className="text-xs text-muted-foreground">Only track changes, no snapshot</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="exported">
                        <div className="flex items-center gap-2 w-full text-left">
                          <Shield className="h-4 w-4 text-green-600" />
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
                          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
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

            {/* Advanced Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Advanced Configuration (Optional)</h3>
              
              <div className="space-y-2">
                <Label htmlFor="additionalConfig">Additional Config (JSON)</Label>
                <textarea
                  id="additionalConfig"
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.additionalConfig || ''}
                  onChange={(e) => handleChange('additionalConfig', e.target.value)}
                  placeholder='{"transforms": "...", "predicates": "..."}'
                />
                <p className="text-xs text-gray-500">
                  Additional connector configuration in JSON format
                </p>
              </div>
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
