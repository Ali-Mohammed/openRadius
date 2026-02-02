import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { format } from 'date-fns'
import { sasRadiusApi } from '@/api/sasRadiusApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SessionsTabProps {
  userId: string
}

export function SessionsTab({ userId }: SessionsTabProps) {
  const { currentWorkspaceId } = useWorkspace()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { data: sessionsData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['radius-user-sessions', userId, page, pageSize],
    queryFn: () => sasRadiusApi.getUserSessions(currentWorkspaceId, userId, page, pageSize, 'acctstarttime', 'desc', ''),
    enabled: !!userId && !!currentWorkspaceId,
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return format(new Date(dateStr), 'MMM dd, yyyy HH:mm:ss')
    } catch {
      return dateStr
    }
  }

  const formatDuration = (startTime: string, stopTime: string | null) => {
    if (!stopTime) return 'Active'
    try {
      const start = new Date(startTime)
      const stop = new Date(stopTime)
      const diff = stop.getTime() - start.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      return `${hours}h ${minutes}m ${seconds}s`
    } catch {
      return '-'
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Sessions</CardTitle>
              <CardDescription>Loading session data...</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Sessions</CardTitle>
          <CardDescription>Error loading session data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load session data. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  const hasData = sessionsData && sessionsData.data.length > 0
  const totalPages = sessionsData?.last_page || 1

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle>User Sessions</CardTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Sessions Table */}
        {hasData ? (
          <div className="rounded-md border">
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Session ID</TableHead>
                    <TableHead className="w-[180px]">Start Time</TableHead>
                    <TableHead className="w-[180px]">Stop Time</TableHead>
                    <TableHead className="w-[120px]">Duration</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[130px]">IP Address</TableHead>
                    <TableHead className="text-right w-[110px]">Download</TableHead>
                    <TableHead className="text-right w-[110px]">Upload</TableHead>
                    <TableHead className="w-[140px]">MAC Address</TableHead>
                    <TableHead className="w-[120px]">NAS IP</TableHead>
                    <TableHead className="w-[180px]">Profile</TableHead>
                    <TableHead className="w-[140px]">Terminate Cause</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData.data.map((session) => (
                    <TableRow key={session.radacctid}>
                      <TableCell className="font-medium">{session.radacctid}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(session.acctstarttime)}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(session.acctstoptime)}</TableCell>
                      <TableCell className="text-sm">{formatDuration(session.acctstarttime, session.acctstoptime)}</TableCell>
                      <TableCell>
                        {session.acctstoptime ? (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800">Stopped</Badge>
                        ) : (
                          <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{session.framedipaddress}</TableCell>
                      <TableCell className="text-right text-sm">{formatBytes(session.acctoutputoctets)}</TableCell>
                      <TableCell className="text-right text-sm">{formatBytes(session.acctinputoctets)}</TableCell>
                      <TableCell className="font-mono text-xs">{session.callingstationid}</TableCell>
                      <TableCell className="font-mono text-xs">{session.nasipaddress}</TableCell>
                      <TableCell>
                        {session.profile_details ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-sm">{session.profile_details.name}</div>
                            <div className="text-xs text-muted-foreground">ID: {session.profile_details.id}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.acctterminatecause ? (
                          <Badge variant="outline" className="text-xs">{session.acctterminatecause}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No sessions found</p>
            </div>
          </div>
        )}

        {/* Pagination */}
        {hasData && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {sessionsData.from} to {sessionsData.to} of {sessionsData.total} sessions
              </div>
              <Select value={pageSize.toString()} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}>
                <SelectTrigger className="w-[110px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(1)}
                disabled={page === 1 || isFetching}
                className="h-8 w-8"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || isFetching}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 px-2">
                <span className="text-sm font-medium">
                  {page} / {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages || isFetching}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || isFetching}
                className="h-8 w-8"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
