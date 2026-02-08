import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  systemUpdateApi,
  type ServiceUpdateInfo,
  type ServiceUpdateResult,
  type PreUpdateCheckResult,
} from '@/api/systemUpdateApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  AlertTriangle,
  DatabaseBackup,
  Shield,
  CircleCheck,
  CircleX,
  XCircle,
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
  isSelected,
  isUpdating,
  onToggleSelect,
}: {
  service: ServiceUpdateInfo
  isSelected: boolean
  isUpdating: boolean
  onToggleSelect: () => void
}) {
  const isBackend = service.serviceName === 'backend'
  const Icon = isBackend ? Server : Globe
  const canSelect = service.updateAvailable && !isUpdating

  return (
    <Card
      className={`transition-all ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20'
          : service.updateAvailable
            ? 'border-blue-500/50'
            : ''
      } ${isUpdating ? 'opacity-75' : ''}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Selection checkbox */}
            <div className="flex items-center">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelect}
                disabled={!canSelect}
                className="h-5 w-5"
              />
            </div>
            <div
              className={`p-2.5 rounded-lg flex items-center justify-center ${
                isUpdating
                  ? 'bg-amber-500/10 text-amber-600'
                  : service.updateAvailable
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-green-500/10 text-green-600'
              }`}
            >
              {isUpdating ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Icon className="h-6 w-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl capitalize">{service.serviceName}</CardTitle>
              <CardDescription className="font-mono text-xs mt-1">
                {service.imageName}:{service.tag}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isUpdating && (
              <Badge variant="default" className="bg-amber-600">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Updating…
              </Badge>
            )}
            {!isUpdating && getStatusBadge(service.status)}
          </div>
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
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{service.errorMessage}</span>
            </div>
          </>
        )}

        {/* Status Footer */}
        {service.status === 'up-to-date' && !isUpdating && (
          <>
            <Separator />
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 py-1">
              <ShieldCheck className="h-4 w-4" />
              <span>Running the latest version</span>
            </div>
          </>
        )}

        {service.updateAvailable && !isUpdating && (
          <>
            <Separator />
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600 py-1">
              <ArrowUpCircle className="h-4 w-4" />
              <span>New version available — select to update</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── Update Results Component ────────────────────────────────────────────────

function UpdateResultsPanel({ results }: { results: ServiceUpdateResult[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Update Results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((result, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 p-3 rounded-lg border ${
              result.success
                ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900'
                : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
            }`}
          >
            {result.success ? (
              <CircleCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold capitalize">{result.serviceName}</span>
                <Badge variant={result.success ? 'default' : 'destructive'} className="text-xs">
                  {result.success ? 'Success' : 'Failed'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
              {result.oldDigest && result.newDigest && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 font-mono">
                  <span>{shortenDigest(result.oldDigest, 12)}</span>
                  <span>→</span>
                  <span className="text-green-600">{shortenDigest(result.newDigest, 12)}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(result.updatedAt)}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function SystemUpdatePage() {
  const queryClient = useQueryClient()
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [updatingServices, setUpdatingServices] = useState<Set<string>>(new Set())
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [backupConfirmed, setBackupConfirmed] = useState(false)
  const [preCheckResult, setPreCheckResult] = useState<PreUpdateCheckResult | null>(null)
  const [isRunningPreChecks, setIsRunningPreChecks] = useState(false)
  const [updateResults, setUpdateResults] = useState<ServiceUpdateResult[] | null>(null)

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

  // Update selected services
  const updateSelectedMutation = useMutation({
    mutationFn: systemUpdateApi.updateSelected,
    onSuccess: (results) => {
      setUpdateResults(results)
      const allSuccess = results.every((r) => r.success)
      if (allSuccess) {
        toast.success(`Successfully updated: ${results.map((r) => r.serviceName).join(', ')}`)
      } else {
        const failed = results.filter((r) => !r.success).map((r) => r.serviceName)
        toast.warning(`Some services failed: ${failed.join(', ')}`)
      }
      setUpdatingServices(new Set())
      setSelectedServices(new Set())
      setBackupConfirmed(false)
      setPreCheckResult(null)
      queryClient.invalidateQueries({ queryKey: ['system-update-status'] })
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } } }
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Update failed')
      setUpdatingServices(new Set())
    },
  })

  // Toggle service selection
  const toggleService = useCallback((serviceName: string) => {
    setSelectedServices((prev) => {
      const next = new Set(prev)
      if (next.has(serviceName)) {
        next.delete(serviceName)
      } else {
        next.add(serviceName)
      }
      return next
    })
    // Reset pre-checks when selection changes
    setPreCheckResult(null)
    setBackupConfirmed(false)
  }, [])

  // Select all updatable services
  const selectAll = useCallback(() => {
    const updatable = status?.services.filter((s) => s.updateAvailable).map((s) => s.serviceName) ?? []
    setSelectedServices(new Set(updatable))
    setPreCheckResult(null)
    setBackupConfirmed(false)
  }, [status])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedServices(new Set())
    setPreCheckResult(null)
    setBackupConfirmed(false)
  }, [])

  // Start the update flow: run pre-checks → show confirmation dialog
  const handleInitiateUpdate = async () => {
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service to update')
      return
    }

    setIsRunningPreChecks(true)
    setPreCheckResult(null)

    try {
      const result = await systemUpdateApi.preCheck(Array.from(selectedServices))
      setPreCheckResult(result)
      setShowConfirmDialog(true)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      toast.error('Failed to run pre-update checks: ' + (err.response?.data?.message || err.message))
    } finally {
      setIsRunningPreChecks(false)
    }
  }

  // Confirm and execute the update
  const handleConfirmUpdate = () => {
    if (!backupConfirmed) {
      toast.error('You must confirm that a full backup has been performed')
      return
    }

    setShowConfirmDialog(false)
    const services = Array.from(selectedServices)
    setUpdatingServices(new Set(services))
    setUpdateResults(null)

    updateSelectedMutation.mutate({
      services,
      backupConfirmed: true,
    })
  }

  const hasUpdates = status?.services?.some((s) => s.updateAvailable) ?? false
  const isAnyUpdating = updatingServices.size > 0
  const updatableCount = status?.services?.filter((s) => s.updateAvailable).length ?? 0

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
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching || isAnyUpdating}
        >
          <RefreshCcw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? 'Checking…' : 'Check for Updates'}
        </Button>
      </div>

      {/* Status Info */}
      {status?.checkedAt && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Last checked: {formatDate(status.checkedAt)}
        </div>
      )}

      {/* Selection Actions Bar */}
      {hasUpdates && !isAnyUpdating && (
        <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <ArrowUpCircle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    {updatableCount} update{updatableCount !== 1 ? 's' : ''} available
                  </span>
                  {selectedServices.size > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedServices.size} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    Select All
                  </Button>
                  {selectedServices.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={handleInitiateUpdate}
                disabled={selectedServices.size === 0 || isRunningPreChecks}
                size="lg"
              >
                {isRunningPreChecks ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Pre-checks…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Update Selected ({selectedServices.size})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currently Updating Banner */}
      {isAnyUpdating && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-400">Update in Progress</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Updating: <strong>{Array.from(updatingServices).join(', ')}</strong>. 
            Do not close this page or restart services manually. 
            {updatingServices.has('backend') && (
              <span className="block mt-1">
                ⚠ The backend is being updated — you may briefly lose connectivity.
              </span>
            )}
          </AlertDescription>
        </Alert>
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
              isSelected={selectedServices.has(service.serviceName)}
              isUpdating={updatingServices.has(service.serviceName)}
              onToggleSelect={() => toggleService(service.serviceName)}
            />
          ))}
        </div>
      )}

      {/* Update Results */}
      {updateResults && updateResults.length > 0 && <UpdateResultsPanel results={updateResults} />}

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About System Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
              <span>
                Updates only affect the <strong>backend</strong> and <strong>frontend</strong> services.
                All other services (database, Keycloak, Redis, etc.) remain stable.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <DatabaseBackup className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
              <span>
                Always perform a <strong>full database backup</strong> before applying any updates.
                Navigate to <strong>Database Backup</strong> to create one.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <span>
                Backend updates will cause a brief API outage. Plan updates during low-traffic periods.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <ArrowUpCircle className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
              <span>
                <strong>Recommended order:</strong> Update frontend first, then backend to minimize downtime.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confirmation Dialog ────────────────────────────────────────────── */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm System Update
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                {/* Services to update */}
                <div>
                  <p className="font-medium text-foreground mb-2">
                    The following services will be updated:
                  </p>
                  <div className="flex gap-2">
                    {Array.from(selectedServices).map((name) => (
                      <Badge key={name} variant="default" className="capitalize text-sm px-3 py-1">
                        {name === 'backend' ? (
                          <Server className="h-3.5 w-3.5 mr-1.5" />
                        ) : (
                          <Globe className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Pre-update check results */}
                {preCheckResult && (
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Pre-update Health Checks:</p>
                    <div className="space-y-1.5 rounded-lg border p-3 bg-muted/30">
                      {preCheckResult.checks.map((check, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {check.passed ? (
                            <CircleCheck className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <CircleX className="h-4 w-4 text-red-600 shrink-0" />
                          )}
                          <span className={check.passed ? 'text-foreground' : 'text-red-600'}>
                            <strong>{check.name}:</strong> {check.message}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Warnings */}
                    {preCheckResult.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1.5">
                        {preCheckResult.warnings.map((warning, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* System not ready */}
                    {!preCheckResult.ready && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertTitle>System Not Ready</AlertTitle>
                        <AlertDescription>
                          One or more critical pre-update checks failed. Resolve the issues above before proceeding.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Backup confirmation */}
                <div className="rounded-lg border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <DatabaseBackup className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-300">
                        Full Backup Required
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                        Before proceeding, ensure you have performed a <strong>full database backup</strong>. 
                        Updates cannot be automatically rolled back. If something goes wrong, you will need 
                        to restore from backup.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
                    <Checkbox
                      checked={backupConfirmed}
                      onCheckedChange={(checked) => setBackupConfirmed(checked === true)}
                      className="h-5 w-5"
                    />
                    <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      I confirm that a full backup has been performed and I understand the risks
                    </span>
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              onClick={() => {
                setBackupConfirmed(false)
                setPreCheckResult(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={!backupConfirmed || (preCheckResult != null && !preCheckResult.ready)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Proceed with Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
