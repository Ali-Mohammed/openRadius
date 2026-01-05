import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
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
import { toast } from 'sonner';

interface Settings {
  id?: number;
  connectUrl: string;
  username?: string;
  password?: string;
  isDefault: boolean;
}

export default function DebeziumSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');
  const [formData, setFormData] = useState<Settings>({
    connectUrl: 'http://localhost:8083',
    username: '',
    password: '',
    isDefault: true,
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/settings`);
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      setFormData(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (field: keyof Settings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const testConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus('unknown');
      
      const response = await fetch(`${appConfig.api.baseUrl}/api/debezium/settings/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.connected) {
        setConnectionStatus('connected');
        toast.success(result.message || 'Successfully connected to Debezium Connect');
      } else {
        setConnectionStatus('failed');
        toast.error(result.message || 'Connection failed');
      }
    } catch (error: any) {
      setConnectionStatus('failed');
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };
      } else {
        setConnectionStatus('failed');
        toast.error('Unable to connect to Debezium Connect');
      }
    } catch (error: any) {
      setConnectionStatus('failed');
      toast.error(error.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = formData.id
        ? `${appConfig.api.baseUrl}/api/debezium/settings/${formData.id}`
        : `${appConfig.api.baseUrl}/api/debezium/settings`;

      const response = await fetch(url, {
        method: formData.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      toast.success('Settings saved successfully');
      fetchSettings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Debezium Settings</CardTitle>
          <CardDescription>
            Configure connection to Debezium Connect for managing CDC connectors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Connection Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Connection Configuration</h3>
              
              <div className="space-y-2">
                <Label htmlFor="connectUrl">Debezium Connect URL *</Label>
                <div className="flex gap-2">
                  <Input
                    id="connectUrl"
                    value={formData.connectUrl}
                    onChange={(e) => handleChange('connectUrl', e.target.value)}
                    placeholder="http://localhost:8083"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testConnection}
                    disabled={testing}
                  >
                    {testing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Test'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  The base URL of your Debezium Connect REST API
                </p>
                {connectionStatus === 'connected' && (
                  <p className="text-xs text-green-600">✓ Connection successful</p>
                )}
                {connectionStatus === 'failed' && (
                  <p className="text-xs text-red-600">✗ Connection failed</p>
                )}
              </div>
            </div>

            {/* Authentication (Optional) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Authentication (Optional)</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username || ''}
                    onChange={(e) => handleChange('username', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => handleChange('password', e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Leave empty if your Debezium Connect instance doesn't require authentication
              </p>
            </div>

            {/* Information */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Default Configuration</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Connect URL: http://localhost:8083</li>
                <li>• Service: connect_cloud (from docker-compose.yml)</li>
                <li>• Kafka Broker: redpanda:9092</li>
                <li>• No authentication required by default</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={fetchSettings}>
                Reset
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
