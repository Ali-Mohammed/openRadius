import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, Download, RefreshCw, HardDrive, RotateCcw, Trash2, History } from 'lucide-react'
import { databaseBackupApi, type DatabaseInfo, type BackupHistoryItem } from '@/services/databaseBackupApi'
import { formatApiError } from '@/utils/errorHandler'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function DatabaseBackup() {
  const queryClient = useQueryClient()
  const [backupDialogOpen, setBackupDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseInfo | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<BackupHistoryItem | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: databases = [], isLoading, refetch } = useQuery({
    queryKey: ['databases'],
    queryFn: () => databaseBackupApi.getDatabases(),
  })

  const { data: backupHistory = [], isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['backup-history'],
    queryFn: () => databaseBackupApi.getBackupHistory(),
  })

  const backupMutation = useMutation({
    mutationFn: ({ databaseName, type }: { databaseName: string; type: string }) =>
      databaseBackupApi.backupDatabase(databaseName, type),
    onSuccess: () => {
      toast.success('Database backup created successfully')
      setIsProcessing(false)
      setBackupDialogOpen(false)
      refetchHistory()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create backup')
      setIsProcessing(false)
    },
  })

  const downloadMutation = useMutation({
    mutationFn: (backupId: string) => databaseBackupApi.downloadBackup(backupId),
    onSuccess: (blob, backupId) => {
      const backup = backupHistory.find(b => b.id === backupId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = backup?.fileName || 'backup.sql'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Backup downloaded successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to download backup')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (backupId: string) => databaseBackupApi.restoreBackup(backupId),
    onSuccess: () => {
      toast.success('Database restored successfully')
      setIsProcessing(false)
      setRestoreDialogOpen(false)
      setSelectedBackup(null)
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore backup')
      setIsProcessing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (backupId: string) => databaseBackupApi.deleteBackup(backupId),
    onSuccess: () => {
      toast.success('Backup deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedBackup(null)
      queryClient.invalidateQueries({ queryKey: ['backup-history'] })
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete backup')
    },
  })

  const handleBackup = (database: DatabaseInfo) => {
    setSelectedDatabase(database)
    setBackupDialogOpen(true)
  }

  const confirmBackup = () => {
    if (!selectedDatabase) return
    setIsProcessing(true)
    backupMutation.mutate({
      databaseName: selectedDatabase.name,
      type: selectedDatabase.type,
    })
  }

  const handleDownload = (backup: BackupHistoryItem) => {
    downloadMutation.mutate(backup.id)
  }

  const handleRestore = (backup: BackupHistoryItem) => {
    setSelectedBackup(backup)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (!selectedBackup) return
    setIsProcessing(true)
    restoreMutation.mutate(selectedBackup.id)
  }

  const handleDelete = (backup: BackupHistoryItem) => {
    setSelectedBackup(backup)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!selectedBackup) return
    deleteMutation.mutate(selectedBackup.id)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {isProcessing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Processing...</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Backup & Restore</h1>
          <p className="text-muted-foreground">Backup, restore, and manage your database backups</p>
        </div>
        <Button
          onClick={() => {
            refetch()
            refetchHistory()
          }}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Databases List */}
      <Card>
        <CardHeader>
          <CardTitle>Available Databases</CardTitle>
          <CardDescription>
            Select a database to create a backup
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          ) : databases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No databases found
            </div>
          ) : (
            <div className="space-y-3">
              {databases.map((database) => (
                <div
                  key={database.name}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                      {database.type === 'master' ? (
                        <HardDrive className="h-5 w-5 text-primary" />
                      ) : (
                        <Database className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{database.displayName}</div>
                      <div className="text-sm text-muted-foreground">{database.name}</div>
                    </div>
                    <Badge variant={database.type === 'master' ? 'default' : 'secondary'}>
                      {database.type}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => handleBackup(database)}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Create Backup
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Backup History
              </CardTitle>
              <CardDescription>
                Manage your database backups
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-12 flex-1" />
                </div>
              ))}
            </div>
          ) : backupHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No backups found</p>
              <p className="text-sm">Create your first backup to see it here</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Database</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupHistory.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-medium">{backup.databaseName}</TableCell>
                      <TableCell>
                        <Badge variant={backup.databaseType === 'master' ? 'default' : 'secondary'}>
                          {backup.databaseType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{backup.fileName}</TableCell>
                      <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{backup.createdBy}</TableCell>
                      <TableCell className="text-sm">{formatDate(backup.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(backup)}
                            title="Download backup"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(backup)}
                            title="Restore from backup"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(backup)}
                            title="Delete backup"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Confirmation Dialog */}
      <AlertDialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Database Backup</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a full SQL backup of <strong>{selectedDatabase?.displayName}</strong>.
              The backup will be saved on the server and downloaded to your computer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackup} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Creating Backup...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Database</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will restore the database <strong>{selectedBackup?.databaseName}</strong> from the backup:
              </p>
              <p className="font-mono text-sm bg-muted p-2 rounded">
                {selectedBackup?.fileName}
              </p>
              <p className="text-destructive font-semibold">
                ⚠️ Warning: This will replace all current data in the database. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Database
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup?
              <p className="font-mono text-sm bg-muted p-2 rounded mt-2">
                {selectedBackup?.fileName}
              </p>
              <p className="mt-2">
                This action cannot be undone. The backup file will be permanently deleted from the server.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
