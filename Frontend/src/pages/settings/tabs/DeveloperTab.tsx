import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Code, ExternalLink } from 'lucide-react'
import { settingsApi } from '@/api/settingsApi'
import { formatApiError } from '@/utils/errorHandler'
import { appConfig } from '@/config/app.config'

export default function DeveloperTab() {
  const queryClient = useQueryClient()

  const { data: swaggerSetting, isLoading } = useQuery({
    queryKey: ['system-settings', 'swagger'],
    queryFn: () => settingsApi.getSwaggerSetting(),
  })

  const updateSwaggerMutation = useMutation({
    mutationFn: (enabled: boolean) => settingsApi.updateSwaggerSetting(enabled),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['system-settings', 'swagger'] })
      toast.success(`Swagger has been ${enabled ? 'enabled' : 'disabled'}`)
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const handleSwaggerToggle = (checked: boolean) => {
    updateSwaggerMutation.mutate(checked)
  }

  const swaggerUrl = `${appConfig.api.baseUrl}/swagger`

  if (isLoading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          Swagger API Documentation
        </CardTitle>
        <CardDescription>
          Swagger provides interactive API documentation and testing capabilities.
          When enabled, the Swagger UI is accessible at <code className="text-xs bg-muted px-1 py-0.5 rounded">/swagger</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="swagger-toggle" className="text-base font-medium">
              Enable Swagger
            </Label>
            <p className="text-sm text-muted-foreground">
              Allow access to the Swagger API documentation endpoint
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={swaggerSetting?.enabled ? 'default' : 'secondary'}>
              {swaggerSetting?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
            <Switch
              id="swagger-toggle"
              checked={swaggerSetting?.enabled ?? false}
              onCheckedChange={handleSwaggerToggle}
              disabled={updateSwaggerMutation.isPending}
            />
          </div>
        </div>

        {swaggerSetting?.enabled && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <ExternalLink className="h-4 w-4" />
              <span>Swagger UI is available at:</span>
              <a
                href={swaggerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline hover:no-underline"
              >
                {swaggerUrl}
              </a>
            </div>
          </div>
        )}

        {/* Audit trail */}
        {swaggerSetting?.updatedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <span>Last modified:</span>
            <span className="font-medium">
              {new Date(swaggerSetting.updatedAt).toLocaleString()}
            </span>
            {swaggerSetting.updatedByEmail && (
              <>
                <span>by</span>
                <span className="font-medium">{swaggerSetting.updatedByEmail}</span>
              </>
            )}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Security Notice:</strong> Swagger exposes detailed API documentation.
            It is recommended to keep it disabled in production unless actively needed for debugging or development.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
