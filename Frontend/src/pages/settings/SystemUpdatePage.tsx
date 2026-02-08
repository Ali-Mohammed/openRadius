import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { systemUpdateApi, type ServiceUpdateInfo } from '@/api/systemUpdateApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  RefreshCcw,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowUpCircle,
  Server,
  Globe,
  Clock,
  HardDrive,
  Hash,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react'

function formatBytes(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString()
}

function shortenDigest(digest: string | null, length = 16): string {
  if (!digest) return '—'
  const clean = digest.startsWith('sha256:') ? digest.slice(7) : digest
  return clean.length > length ? `${clean.slice(0, length)}…` : clean
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'up-to-date':
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Up to Date
        </Badge>
      )
    case 'update-available':
      return (
        <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
          <ArrowUpCircle className="h-3 w-3 mr-1" />
          Update Available
        </Badge>
      )
    case 'container-not-found':
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" />
          Container Not Found
        </Badge>
      )
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">
          <Info className="h-3 w-3 mr-1" />
          Unknown
        </Badge>
      )
  }
}

function ServiceCard({
  service,
  isUpdating,
  onUpdate,
}: {
  service: ServiceUpdateInfo
  isUpdating: boolean
  onUpdate: () => void
}) {
  const isBackend = service.serviceName === 'backend'
  const Icon = isBackend ? Server : Globe

  return (
    <Card className={service.updateAvailable ? 'border-blue-500/50' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-lg flex items-center justify-center ${
                service.updateAvailable
                  ? 'bg-blue-500/10 text-blue-600'
                  : 'bg-green-500/10 text-green-600'
              }`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl capitalize">{service.serviceName}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {service.imageName}:{service.tag}
              </CardDescription>
            </div>
          </div>
          {getStatusBadge(service.status)}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Version */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Current Version
          </h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                Digest
              </span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                {shortenDigest(service.currentDigest)}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Created
              </span>
              <span className="text-xs">{formatDate(service.currentCreatedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                Container Status
              </span>
              <Badge variant={service.currentStatus === 'running' ? 'default' : 'secondary'} className="text-xs">
                {service.currentStatus || '—'}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Latest on Docker Hub */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Latest on Docker Hub
          </h4>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Hash className="h-3.5 w-3.5" />
                Digest
              </span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                {shortenDigest(service.latestDigest)}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Pushed
              </span>
              <span className="text-xs">{formatDate(service.latestPushedAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                Size
              </span>
              <span className="text-xs">{formatBytes(service.latestSizeBytes)}</span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {service.errorMessage && (
          <>
            <Separator />
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{service.errorMessage}</span>
            </div>
          </>
        )}

        {/* Update Button */}
        {service.updateAvailable && (
          <>
            <Separator />
            <Button
              onClick={onUpdate}
              disabled={isUpdating}
              className="w-full"
              size="lg"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating {service.serviceName}…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Update {service.serviceName}
                </>
              )}
            </Button>
          </>
        )}

        {service.status === 'up-to-date' && (
          <>
            <Separator />
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Running the latest version</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function SystemUpdatePage() {
  const queryClient = useQueryClient()
  const [updatingService, setUpdatingService] = useState<string | null>(null)

  // Check for updates
  const {
    data: status,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['system-update-status'],
    queryFn: systemUpdateApi.getStatus,
    staleTime: 0,
    refetchOnMount: 'always',
  })

  // Update a single service
  const updateMutation = useMutation({
    mutationFn: systemUpdateApi.updateService,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
      setUpdatingService(null)
      queryClient.invalidateQueries({ queryKey: ['system-update-status'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Update failed')
      setUpdatingService(null)
    },
  })

  // Update all services
  const updateAllMutation = useMutation({
    mutationFn: systemUpdateApi.updateAll,
    onSuccess: (results) => {
      const allSuccess = results.every((r) => r.success)
      if (allSuccess) {
        toast.success('All services updated successfully')
      } else {
        const failed = results.filter((r) => !r.success).map((r) => r.serviceName)
        toast.warning(`Some services failed to update: ${failed.join(', ')}`)
      }
      setUpdatingService(null)
      queryClient.invalidateQueries({ queryKey: ['system-update-status'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Update all failed')
      setUpdatingService(null)
    },
  })

  const handleUpdateService = (serviceName: string) => {
    setUpdatingService(serviceName)
    updateMutation.mutate(serviceName)
  }

  const handleUpdateAll = () => {
    setUpdatingService('all')
    updateAllMutation.mutate()
  }

  const hasUpdates = status?.services?.some((s) => s.updateAvailable) ?? false
  const isAnyUpdating = updatingService !== null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Update</h1>
          <p className="text-muted-foreground">
            Check and apply updates for backend and frontend services
          </p>
        </div>
        <div className="flex gap-2">
          {hasUpdates && (
            <Button
              onClick={handleUpdateAll}
              disabled={isAnyUpdating}
            >
              {updatingService === 'all' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating All…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Update All
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Checking…' : 'Check for Updates'}
          </Button>
        </div>
      </div>

      {/* Status Info */}
      {status?.checkedAt && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Last checked: {formatDate(status.checkedAt)}
        </div>
      )}

      {/* Service Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Checking for updates…</span>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {status?.services.map((service) => (
            <ServiceCard
              key={service.serviceName}
              service={service}
              isUpdating={
                updatingService === service.serviceName || updatingService === 'all'
              }
              onUpdate={() => handleUpdateService(service.serviceName)}
            />
          ))}
        </div>
      )}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About System Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Updates only affect the <strong>backend</strong> and <strong>frontend</strong> services.
            All other services (database, Keycloak, Redpanda, etc.) remain stable and unchanged.
          </p>
          <p>
            The update process pulls the latest Docker image from Docker Hub and restarts the
            container. During a backend update, you may briefly lose connectivity.
          </p>
          <p>
            <strong>Tip:</strong> Always update the frontend first, then the backend to minimize
            downtime.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
