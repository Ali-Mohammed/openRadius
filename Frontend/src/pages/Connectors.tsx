import { useState, useEffect } from 'react';
import { Plus, Play, Pause, RefreshCw, Trash2, Edit, AlertCircle } from 'lucide-react';
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

  const fetchConnectors = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors`);
      if (!response.ok) throw new Error('Failed to fetch connectors');
      
      const data = await response.json();
      
      // Merge Debezium and database connectors
      const mergedConnectors: any[] = [];
      
      if (data.debezium) {
        Object.entries(data.debezium).forEach(([name, info]: [string, any]) => {
          const dbConnector = data.database?.find((c: Connector) => c.name === name);
          mergedConnectors.push({
            name,
            status: info.status?.connector?.state || 'UNKNOWN',
            type: info.info?.type || 'source',
            config: info.info?.config || {},
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

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete connector "${name}"?`)) return;

    try {
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/connectors/${name}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete connector');

      toast.success('Connector deleted successfully');

      fetchConnectors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete connector');
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Debezium Connectors</CardTitle>
              <CardDescription>
                Manage Change Data Capture (CDC) connectors for database synchronization
              </CardDescription>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Connector
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : connectors.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No connectors found</p>
              <p className="text-sm text-gray-400 mt-2">
                Click "Add Connector" to create your first CDC connector
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Database</TableHead>
                  <TableHead>Tables</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((connector) => (
                  <TableRow key={connector.name}>
                    <TableCell className="font-medium">{connector.name}</TableCell>
                    <TableCell>{connector.type}</TableCell>
                    <TableCell>{getStatusBadge(connector.status)}</TableCell>
                    <TableCell>
                      {connector.config['database.hostname'] || connector.database?.databaseHostname || '-'}:
                      {connector.config['database.port'] || connector.database?.databasePort || '-'}/
                      {connector.config['database.dbname'] || connector.database?.databaseName || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {connector.config['table.include.list'] || connector.database?.tableIncludeList || '-'}
                    </TableCell>
                    <TableCell>
                      {connector.tasks?.length || 0} task(s)
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
                          onClick={() => handleDelete(connector.name)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
