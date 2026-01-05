import { useState, useEffect } from 'react';
import { ArrowLeft, Save, HelpCircle, Database, FileJson, Camera, Clock, Zap, Shield } from 'lucide-react';
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
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-.7533-.2453-.2972.1036-.4322.4132-.3275.6964.0224.0613.0476.1226.0813.1712a.5372.5372 0 0 0 .0889.0927c.6935.5469 1.0683 1.3925.9977 2.2362-.0934 1.1026-.843 2.0548-1.9384 2.4622-.9351.3479-1.9907.3479-2.9258 0-.9955-.3702-1.7439-1.1926-2.0518-2.2698-.1862-.6509-.1806-1.3306.0166-1.9816.1675-.5495.4452-1.0447.8087-1.4568.0389-.0445.0722-.0947.1112-.1392.0334-.0445.0668-.0778.0946-.1169a2.5415 2.5415 0 0 0 .1703-.3479c.0722-.1948.1369-.3924.1925-.5956.0445-.1615.0778-.3313.1056-.4955.0334-.1642.0611-.3368.0723-.5122.0278-.4121-.0055-.8354-.0946-1.2587-.0445-.2298-.1056-.4567-.1723-.6781-.0668-.2298-.1503-.4484-.2366-.6725-.0334-.0779-.0723-.1559-.1112-.2298-.0389-.0779-.0834-.1503-.1335-.2187-.1224-.1726-.2559-.3313-.405-.4734-.1168-.1113-.2421-.2121-.3702-.3091-.1168-.0861-.2421-.1614-.3702-.2254-.1224-.0584-.2504-.1-.3758-.1392-.1169-.0334-.2393-.0639-.3591-.0806-.1335-.0222-.2642-.0334-.4004-.033h-.0334c-.1634 0-.3241.0167-.4846.05-.1392.0278-.2754.0667-.4088.1168-.1224.0445-.2393.1-.3536.1671-.1113.0639-.2198.1392-.3241.2254-.1056.0861-.2026.1781-.2948.2785-.0889.1058-.1724.2187-.2476.3397-.0751.1168-.1447.2393-.2026.3702-.0611.1308-.1112.2643-.1558.405-.0445.1391-.0778.2837-.1-.4295-.0223-.1503-.033-.3063-.0389-.4679-.0056-.1559 0-.3174.0167-.4762.0166-.1559.05-.3146.0972-.4678.0445-.1559.1056-.3118.1835-.4595.0778-.1503.1781-.2948.2948-.4233.1224-.1336.2615-.2532.4149-.3507.1503-.0945.3174-.1698.4956-.2187.1558-.0445.3174-.0722.4846-.0834.1614-.0111.3256 0 .4928.033.1559.0334.3146.0834.4706.1503.1447.0639.2865.1392.4178.2298.1224.0834.2392.1781.3508.2865.1112.1112.2136.2365.3063.3702.0889.1282.1669.2643.2337.4094.0668.1392.1223.2865.1724.4233.0445.1336.083.2756.1168.4205.0334.1559.0556.3146.0723.4817.0167.1559.0278.3174.0223.4873 0 .1615-.0167.3229-.0445.4956a5.2042 5.2042 0 0 1-.1169.5011c-.0501.1782-.1112.3647-.1892.5539-.0778.1948-.1781.3924-.2865.5956-.0389.0723-.0779.1503-.1168.2254-.0334.0612-.0723.1169-.1057.1726-.0778.1113-.1613.2143-.2531.3063-.0945.0917-.1948.1781-.3.2559-.1112.0778-.2281.1503-.3508.2143-.1224.0667-.2504.1224-.3813.1725-.1391.0501-.2837.0945-.4344.1336-.1559.0389-.3174.0723-.4846.0945-.1671.0222-.3396.033-.5178.033-.1558 0-.3174-.0056-.4789-.0278-.1447-.0167-.2865-.0445-.4261-.0778-.1335-.0334-.2698-.0723-.4094-.1169-.1391-.0445-.2837-.1-.4261-.1614-.1558-.0668-.3118-.1447-.4733-.2365-.1671-.0945-.3342-.2032-.5067-.3313-.0723-.0556-.1447-.1169-.2198-.1781-.0334-.0278-.0668-.0556-.1002-.0889a.1559.1559 0 0 0-.0445-.0445c-.0612-.0556-.1335-.0945-.2143-.1169-.0834-.0222-.1781-.0167-.2643.0167-.0834.0334-.1559.0945-.2032.1781a.3815.3815 0 0 0-.0612.2476c.0056.0834.0334.1614.0778.2298.0445.0723.1.1391.1614.2032.0223.0223.0445.0445.0668.0668.0723.0723.1503.1391.2309.2032.1781.1447.3674.2754.5678.3924.2032.1169.4205.2198.6509.3063.2359.0889.4845.1614.7476.2143.2698.0556.5483.0945.8352.1169.2921.0167.5955.0111.9072-.0278.3174-.0389.6509-.1058 1.0072-.2087.3508-.1.7154-.2393 1.0961-.4122.3868-.1781.7925-.4011 1.2148-.6848.4261-.2837.8769-.6342 1.3445-1.0571.4595-.4178.9324-.9072 1.3948-1.4679.4566-.5551.9018-1.1805 1.3166-1.8689.2143-.3507.4178-.7097.6008-1.0682.1224-.2393.2365-.4817.3396-.7241.1112-.2587.2087-.5206.2976-.7881.0945-.2754.1781-.5539.2532-.8408.0389-.1559.0778-.3146.1112-.4734.0167-.0778.0334-.1503.0445-.2254.0111-.0834.0223-.1558.0278-.2365.0056-.0779.0056-.1614.0056-.2421 0-.1252-.0111-.2476-.0278-.3785-.0167-.1224-.0445-.2476-.0779-.3785-.0167-.0612-.033-.1169-.0556-.1781z" fill="#336791"/>
                          </svg>
                          PostgreSQL
                        </div>
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mysql.MySqlConnector">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                            <path d="M16.405 5.501c-.115 0-.193.014-.274.033v.013h.014c.054.104.146.174.214.273.054.104.104.22.159.333l.013.014c.114.104.235.188.344.298.054.054.159.104.22.188.104.146.188.298.298.451.054.088.104.188.188.273.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.104.054.235.104.344.188.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.235.104.344.188.054.054.146.104.188.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.054.054.146.104.188.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.235.104.344.188.054.054.146.104.188.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298.054.054.146.104.188.188.104.104.188.214.298.298.104.088.214.188.344.298.054.054.159.104.22.188.104.088.188.214.298.298z" fill="#00758F"/>
                          </svg>
                          MySQL
                        </div>
                      </SelectItem>
                      <SelectItem value="io.debezium.connector.mongodb.MongoDbConnector">
                        <div className="flex items-center gap-2">
                          <Database className="h-5 w-5 text-green-600" />
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
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">pgoutput</div>
                            <div className="text-xs text-muted-foreground">Built-in, no extra installation</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="decoderbufs">
                        <div className="flex items-center gap-2">
                          <FileJson className="h-4 w-4 text-purple-600" />
                          <div>
                            <div className="font-medium">decoderbufs</div>
                            <div className="text-xs text-muted-foreground">Protocol buffers format</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="wal2json">
                        <div className="flex items-center gap-2">
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
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium">Filtered</div>
                            <div className="text-xs text-muted-foreground">Only specified tables (Recommended)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="all_tables">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">All Tables</div>
                            <div className="text-xs text-muted-foreground">Track all tables in the database</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="disabled">
                        <div className="flex items-center gap-2">
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
                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-blue-600" />
                          <div>
                            <div className="font-medium">Initial</div>
                            <div className="text-xs text-muted-foreground">Snapshot on first run only (Recommended)</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="always">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <div>
                            <div className="font-medium">Always</div>
                            <div className="text-xs text-muted-foreground">Snapshot every time connector starts</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="never">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-purple-600" />
                          <div>
                            <div className="font-medium">Never</div>
                            <div className="text-xs text-muted-foreground">Only track changes, no snapshot</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="exported">
                        <div className="flex items-center gap-2">
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
                          <p className="max-w-xs">Comma-separated list of tables to track changes from. Format: schema.table (e.g., public.users,public.orders)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="tableIncludeList"
                    value={formData.tableIncludeList}
                    onChange={(e) => handleChange('tableIncludeList', e.target.value)}
                    placeholder="e.g., public.users,public.orders"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Only changes from these tables will be captured
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
