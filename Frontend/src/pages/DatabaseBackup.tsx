import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Database, Download, RefreshCw, HardDrive } from 'lucide-react'
import { databaseBackupApi, type DatabaseInfo } from '@/services/databaseBackupApi'
import { formatApiError } from '@/utils/errorHandler'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

export default function DatabaseBackup() {
  const [backupDialogOpen, setBackupDialogOpen] = useState(false)
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseInfo | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const { data: databases = [], isLoading, refetch } = useQuery({
    queryKey: ['databases'],
    queryFn: () => databaseBackupApi.getDatabases(),
  })

  const { data: backupHistory = [] } = useQuery({
    queryKey: ['backup-history'],
    queryFn: () => databaseBackupApi.getBackupHistory(),
  })

  const backupMutation = useMutation({
    mutationFn: ({ databaseName, type }: { databaseName: string; type: string }) =>
      databaseBackupApi.backupDatabase(databaseName, type),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${variables.databaseName}_${new Date().toISOString().split('T')[0]}.sql`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Database backup downloaded successfully')
      setIsProcessing(false)
      setBackupDialogOpen(false)
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create backup')
      setIsProcessing(false)
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
          <span className="text-sm font-medium">Processing backup...</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Database Backup</h1>
          <p className="text-muted-foreground">Backup your databases to SQL files</p>
        </div>
        <Button
          onClick={() => refetch()}
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
            Select a database to backup
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
                  <div className="flex gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                  </div>
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
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleBackup(database)}
                      variant="outline"
                      size="sm"
                      disabled={isProcessing}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Backup
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup History */}
      {backupHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>
              Recent database backups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Database</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backupHistory.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell>{backup.databaseName}</TableCell>
                    <TableCell className="font-mono text-sm">{backup.fileName}</TableCell>
                    <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
                    <TableCell>{formatDate(backup.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Backup Confirmation Dialog */}
      <AlertDialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Backup Database</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a full SQL backup of <strong>{selectedDatabase?.displayName}</strong>.
              The backup file will be downloaded to your computer.
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
    </div>
  )
}
