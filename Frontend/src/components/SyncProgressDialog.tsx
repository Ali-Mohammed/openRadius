import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSyncHub, SyncStatus, SyncPhase } from '@/hooks/useSyncHub'
import { CheckCircle2, XCircle, Loader2, ArrowRight, Users, Layers, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sasRadiusApi, type SyncProgress } from '@/api/sasRadiusApi'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatNumber, formatDate, formatRelativeTime } from '@/utils/formatNumber'

interface SyncProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  syncId: string | null
  instantId: number
}

const getStatusInfo = (status: SyncStatus) => {
  switch (status) {
    case SyncStatus.Starting:
      return { label: 'Starting', color: 'bg-blue-500', icon: Loader2, spin: true }
    case SyncStatus.Authenticating:
      return { label: 'Authenticating', color: 'bg-blue-500', icon: Loader2, spin: true }
    case SyncStatus.SyncingProfiles:
      return { label: 'Syncing Profiles', color: 'bg-purple-500', icon: Layers, spin: false }
    case SyncStatus.FetchingProfilePage:
      return { label: 'Fetching Profiles', color: 'bg-purple-500', icon: Loader2, spin: true }
    case SyncStatus.ProcessingProfiles:
      return { label: 'Processing Profiles', color: 'bg-purple-500', icon: Loader2, spin: true }
    case SyncStatus.SyncingUsers:
      return { label: 'Syncing Users', color: 'bg-green-500', icon: Users, spin: false }
    case SyncStatus.FetchingUserPage:
      return { label: 'Fetching Users', color: 'bg-green-500', icon: Loader2, spin: true }
    case SyncStatus.ProcessingUsers:
      return { label: 'Processing Users', color: 'bg-green-500', icon: Loader2, spin: true }
    case SyncStatus.Completed:
      return { label: 'Completed', color: 'bg-green-600', icon: CheckCircle2, spin: false }
    case SyncStatus.Failed:
      return { label: 'Failed', color: 'bg-red-500', icon: XCircle, spin: false }
    case SyncStatus.Cancelled:
      return { label: 'Cancelled', color: 'bg-orange-500', icon: X, spin: false }
    default:
      return { label: 'Unknown', color: 'bg-gray-500', icon: Loader2, spin: false }
  }
}

export function SyncProgressDialog({ open, onOpenChange, syncId, instantId }: SyncProgressDialogProps) {
  const { progress, isConnected } = useSyncHub(syncId || undefined)
  const [initialProgress, setInitialProgress] = useState<SyncProgress | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch initial progress state
  useEffect(() => {
    if (syncId && open) {
      setIsLoading(true)
      setFetchError(null)
      sasRadiusApi.getSyncProgress(instantId, syncId)
        .then((data) => {
          setInitialProgress(data)
          setFetchError(null)
        })
        .catch((error) => {
          console.error('Failed to fetch sync progress:', error)
          setFetchError('Failed to load sync progress. The sync may have been removed.')
        })
        .finally(() => setIsLoading(false))
    }
  }, [syncId, instantId, open])

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => {
      if (!syncId) throw new Error('No sync ID')
      return sasRadiusApi.cancelSync(instantId, syncId)
    },
    onSuccess: () => {
      toast.success('Sync cancelled successfully')
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel sync: ' + error.message)
    },
  })

  const currentProgress = progress || initialProgress
  
  // Debug logging
  useEffect(() => {
    if (currentProgress) {
      console.log('Current Progress Data:', {
        startedAt: currentProgress.startedAt,
        completedAt: currentProgress.completedAt,
        integrationName: currentProgress.integrationName,
      })
    }
  }, [currentProgress])
  
  const statusInfo = currentProgress ? getStatusInfo(currentProgress.status) : null
  const StatusIcon = statusInfo?.icon

  const profilesComplete = currentProgress?.currentPhase >= SyncPhase.Users
  const usersComplete = currentProgress?.currentPhase >= SyncPhase.Completed
  const isSyncing = currentProgress && currentProgress.status < SyncStatus.Completed
  const canCancel = isSyncing && currentProgress.status !== SyncStatus.Cancelled

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Sync Progress</span>
            {!isConnected && isSyncing && (
              <Badge variant="outline" className="text-yellow-600">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Connecting...
              </Badge>
            )}
            {isConnected && isSyncing && (
              <Badge variant="outline" className="text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1" />
                Live
              </Badge>
            )}
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="ml-auto"
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3 mr-1" />
                    Cancel Sync
                  </>
                )}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {currentProgress ? (
          <div className="space-y-6">
            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {StatusIcon && (
                    <StatusIcon
                      className={`w-4 h-4 ${statusInfo?.spin ? 'animate-spin' : ''}`}
                    />
                  )}
                  <span className="font-medium">{statusInfo?.label}</span>
                </div>
                <span className="text-muted-foreground">
                  {currentProgress.progressPercentage.toFixed(0)}%
                </span>
              </div>
              <Progress value={currentProgress.progressPercentage} className="h-2" />
              {currentProgress.currentMessage && (
                <p className="text-sm text-muted-foreground">{currentProgress.currentMessage}</p>
              )}
              {currentProgress.errorMessage && (
                <p className="text-sm text-red-600">{currentProgress.errorMessage}</p>
              )}
            </div>

            <Separator />

            {/* Phases */}
            <div className="space-y-4">
              {/* Profile Sync Phase */}
              <div className={`rounded-lg border p-4 ${profilesComplete ? 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800' : 'bg-background'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className={`w-5 h-5 ${profilesComplete ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`} />
                    <h3 className="font-semibold">Profile Synchronization</h3>
                  </div>
                  {profilesComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  ) : currentProgress.currentPhase === SyncPhase.Profiles ? (
                    <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
                  ) : null}
                </div>

                {currentProgress.profileTotalRecords > 0 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Page Progress:</span>
                      <span className="font-medium">
                        {currentProgress.profileCurrentPage} / {currentProgress.profileTotalPages}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Records:</span>
                      <span className="font-medium">{formatNumber(currentProgress.profileTotalRecords)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{formatNumber(currentProgress.profileProcessedRecords)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-950 rounded">
                        <span className="text-xs text-muted-foreground">New</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatNumber(currentProgress.profileNewRecords)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <span className="text-xs text-muted-foreground">Updated</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatNumber(currentProgress.profileUpdatedRecords)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-950 rounded">
                        <span className="text-xs text-muted-foreground">Failed</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatNumber(currentProgress.profileFailedRecords)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arrow */}
              {currentProgress.profileTotalRecords > 0 && (
                <div className="flex justify-center">
                  <ArrowRight className={`w-6 h-6 ${usersComplete ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                </div>
              )}

              {/* User Sync Phase */}
              <div className={`rounded-lg border p-4 ${usersComplete ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : 'bg-background'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className={`w-5 h-5 ${usersComplete ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                    <h3 className="font-semibold">User Synchronization</h3>
                  </div>
                  {usersComplete ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : currentProgress.currentPhase === SyncPhase.Users ? (
                    <Loader2 className="w-5 h-5 animate-spin text-green-600 dark:text-green-400" />
                  ) : null}
                </div>

                {currentProgress.userTotalRecords > 0 && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Page Progress:</span>
                      <span className="font-medium">
                        {currentProgress.userCurrentPage} / {currentProgress.userTotalPages}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Records:</span>
                      <span className="font-medium">{formatNumber(currentProgress.userTotalRecords)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processed:</span>
                      <span className="font-medium">{formatNumber(currentProgress.userProcessedRecords)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="flex flex-col items-center p-2 bg-green-50 dark:bg-green-950 rounded">
                        <span className="text-xs text-muted-foreground">New</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {formatNumber(currentProgress.userNewRecords)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-blue-50 dark:bg-blue-950 rounded">
                        <span className="text-xs text-muted-foreground">Updated</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatNumber(currentProgress.userUpdatedRecords)}
                        </span>
                      </div>
                      <div className="flex flex-col items-center p-2 bg-red-50 dark:bg-red-950 rounded">
                        <span className="text-xs text-muted-foreground">Failed</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatNumber(currentProgress.userFailedRecords)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Integration: {currentProgress.integrationName}</div>
              <div>Sync ID: {currentProgress.syncId}</div>
              <div>Started: {formatRelativeTime(currentProgress.startedAt)}</div>
              {currentProgress.completedAt && (
                <div>Completed: {formatRelativeTime(currentProgress.completedAt)}</div>
              )}
            </div>
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <XCircle className="w-12 h-12 text-red-500" />
            <div className="text-center">
              <p className="font-medium text-red-600">Unable to load sync</p>
              <p className="text-sm text-muted-foreground mt-1">{fetchError}</p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">No sync data available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
