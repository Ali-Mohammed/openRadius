import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { paymentApi, type PaymentLog } from '@/api/paymentApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'

export default function PaymentInformation() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  
  const { data: paymentHistory, isLoading: isLoadingHistory, refetch } = useQuery({
    queryKey: ['payment-history', statusFilter, searchQuery, pageSize],
    queryFn: () => paymentApi.getPaymentHistory({ 
      pageSize,
      status: statusFilter === 'all' ? undefined : statusFilter
    }),
  })

  const handleSearch = () => {
    setSearchQuery(searchInput)
  }

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Completed</Badge>
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
      case 'failed':
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment History</h1>
          <p className="text-sm text-muted-foreground">View all payment transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search transactions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button onClick={handleSearch} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              onClick={() => refetch()} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoadingHistory ? (
        <div className="rounded-md border">
          <div className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ) : !paymentHistory || paymentHistory.length === 0 ? (
        <div className="rounded-md border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No payment history found</p>
            <p className="text-sm text-muted-foreground">Your payment transactions will appear here</p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-12 px-4">Transaction ID</TableHead>
                <TableHead className="h-12 px-4">Gateway</TableHead>
                <TableHead className="h-12 px-4 text-right">Amount</TableHead>
                <TableHead className="h-12 px-4">Status</TableHead>
                <TableHead className="h-12 px-4">Gateway Reference</TableHead>
                <TableHead className="h-12 px-4">Date</TableHead>
                <TableHead className="h-12 px-4">Error Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.map((log: PaymentLog) => (
                <TableRow key={log.id}>
                  <TableCell className="h-12 px-4 font-mono text-xs">{log.transactionId.substring(0, 16)}...</TableCell>
                  <TableCell className="h-12 px-4">
                    <Badge variant="outline">{log.gateway}</Badge>
                  </TableCell>
                  <TableCell className="h-12 px-4 font-medium text-right">
                    {log.amount.toLocaleString()} {log.currency}
                  </TableCell>
                  <TableCell className="h-12 px-4">{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="h-12 px-4 font-mono text-xs">
                    {log.gatewayTransactionId || log.referenceId || '-'}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-sm text-muted-foreground">
                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="h-12 px-4 text-xs text-destructive max-w-[250px] truncate">
                    {log.errorMessage || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
