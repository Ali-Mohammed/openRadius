import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
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
    }
  }, [connector]);

  const handleChange = (field: keyof Connector, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Auto-generate slot name if empty
      if (!formData.slotName) {
        formData.slotName = `${formData.name.replace(/-/g, '_')}_slot`;
      }

      const url = connector?.id
        ? `${appConfig.api.baseUrl}/api/debezium/connectors/${connector.name}`
        : `${appConfig.api.baseUrl}/api/debezium/connectors`;

      const response = await fetch(url, {
        method: connector?.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
                  <Label htmlFor="name">Connector Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="e.g., cloud-users-source"
                    required
                    disabled={!!connector?.id}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connectorClass">Connector Class *</Label>
                  <Select
                    value={formData.connectorClass}
                    onValueChange={(value) => handleChange('connectorClass', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="io.debezium.connector.postgresql.PostgresConnector">
                        PostgreSQL
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mysql.MySqlConnector">
                        MySQL
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mongodb.MongoDbConnector">
                        MongoDB
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Database Connection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Database Connection</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="databaseHostname">Hostname *</Label>
                  <Input
                    id="databaseHostname"
                    value={formData.databaseHostname}
                    onChange={(e) => handleChange('databaseHostname', e.target.value)}
                    placeholder="localhost or openradius-postgres"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="databasePort">Port *</Label>
                  <Input
                    id="databasePort"
                    type="number"
                    value={formData.databasePort}
                    onChange={(e) => handleChange('databasePort', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="databaseUser">Username *</Label>
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
                  <Label htmlFor="databaseName">Database Name *</Label>
                  <Input
                    id="databaseName"
                    value={formData.databaseName}
                    onChange={(e) => handleChange('databaseName', e.target.value)}
                    placeholder="e.g., openradius"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="databaseServerName">Server Name *</Label>
                  <Input
                    id="databaseServerName"
                    value={formData.databaseServerName}
                    onChange={(e) => handleChange('databaseServerName', e.target.value)}
                    placeholder="Logical name for this server"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Unique logical name for this database server
                  </p>
                </div>
              </div>
            </div>

            {/* CDC Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">CDC Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pluginName">Plugin Name *</Label>
                  <Select
                    value={formData.pluginName}
                    onValueChange={(value) => handleChange('pluginName', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgoutput">pgoutput (Built-in)</SelectItem>
                      <SelectItem value="decoderbufs">decoderbufs</SelectItem>
                      <SelectItem value="wal2json">wal2json</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slotName">Replication Slot Name</Label>
                  <Input
                    id="slotName"
                    value={formData.slotName}
                    onChange={(e) => handleChange('slotName', e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to auto-generate
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publicationAutocreateMode">Publication Mode *</Label>
                  <Select
                    value={formData.publicationAutocreateMode}
                    onValueChange={(value) => handleChange('publicationAutocreateMode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="filtered">Filtered (Recommended)</SelectItem>
                      <SelectItem value="all_tables">All Tables</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snapshotMode">Snapshot Mode *</Label>
                  <Select
                    value={formData.snapshotMode}
                    onValueChange={(value) => handleChange('snapshotMode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Initial (First time only)</SelectItem>
                      <SelectItem value="always">Always</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                      <SelectItem value="exported">Exported</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="tableIncludeList">Table Include List *</Label>
                  <Input
                    id="tableIncludeList"
                    value={formData.tableIncludeList}
                    onChange={(e) => handleChange('tableIncludeList', e.target.value)}
                    placeholder="e.g., public.users,public.orders"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Comma-separated list of tables (schema.table)
                  </p>
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
