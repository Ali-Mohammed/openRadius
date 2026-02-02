import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { format } from 'date-fns'
import { sasRadiusApi } from '@/api/sasRadiusApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface SessionsTabProps {
  userId: string
}

export function SessionsTab({ userId }: SessionsTabProps) {
  const { currentWorkspaceId } = useWorkspace()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const { data: sessionsData, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['radius-user-sessions', userId, page, pageSize, search],
    queryFn: () => sasRadiusApi.getUserSessions(currentWorkspaceId, userId, page, pageSize, 'acctstarttime', 'desc', search),
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

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleRefresh = () => {
    refetch()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Sessions</CardTitle>
          <CardDescription>Loading session data...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>User Sessions</CardTitle>
            <CardDescription>Active and historical session information</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isFetching}>
            Search
          </Button>
        </div>

        {/* Sessions Table */}
        {hasData ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Stop Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                  <TableHead className="text-right">Upload</TableHead>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>NAS IP</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Terminate Cause</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsData.data.map((session) => (
                  <TableRow key={session.radacctid}>
                    <TableCell className="font-medium">{session.radacctid}</TableCell>
                    <TableCell>{formatDateTime(session.acctstarttime)}</TableCell>
                    <TableCell>{formatDateTime(session.acctstoptime)}</TableCell>
                    <TableCell>
                      {session.acctstoptime ? (
                        <Badge variant="secondary">Stopped</Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-600">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{session.framedipaddress}</TableCell>
                    <TableCell className="text-right">{formatBytes(session.acctoutputoctets)}</TableCell>
                    <TableCell className="text-right">{formatBytes(session.acctinputoctets)}</TableCell>
                    <TableCell className="font-mono text-sm">{session.callingstationid}</TableCell>
                    <TableCell className="font-mono text-sm">{session.nasipaddress}</TableCell>
                    <TableCell>
                      {session.profile_details ? (
                        <div>
                          <div className="font-medium">{session.profile_details.name}</div>
                          <div className="text-xs text-muted-foreground">ID: {session.profile_details.id}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {session.acctterminatecause ? (
                        <Badge variant="outline">{session.acctterminatecause}</Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">No sessions found</p>
          </div>
        )}

        {/* Pagination */}
        {hasData && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {sessionsData.from} to {sessionsData.to} of {sessionsData.total} sessions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
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
