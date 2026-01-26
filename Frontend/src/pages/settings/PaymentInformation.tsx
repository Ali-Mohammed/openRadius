import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { paymentApi, type PaymentLog } from '@/api/paymentApi'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'

export default function PaymentInformation() {
  const { data: paymentHistory, isLoading: isLoadingHistory, refetch } = useQuery({
    queryKey: ['payment-history'],
    queryFn: () => paymentApi.getPaymentHistory({ pageSize: 100 }),
  })

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

  if (isLoadingHistory) {
    return <div className="p-6">Loading payment history...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment History</h1>
          <p className="text-muted-foreground">View all payment transactions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {!paymentHistory || paymentHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No payment history found</p>
          <p className="text-sm text-muted-foreground">Your payment transactions will appear here</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Gateway</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Gateway Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Error Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentHistory.map((log: PaymentLog) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">{log.transactionId.substring(0, 16)}...</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.gateway}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.amount.toLocaleString()} {log.currency}
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.gatewayTransactionId || log.referenceId || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-[250px] truncate">
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
