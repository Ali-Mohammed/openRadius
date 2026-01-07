import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  ShoppingCart,
  CreditCard,
  Gift,
  Zap,
  Percent,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import walletHistoryApi from '@/api/walletHistory'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaceApi } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { TRANSACTION_TYPES, TRANSACTION_TYPE_INFO, type TransactionType } from '@/constants/transactionTypes'

const transactionTypeIcons: Record<TransactionType, any> = {
  [TRANSACTION_TYPES.TOP_UP]: ArrowUpCircle,
  [TRANSACTION_TYPES.WITHDRAWAL]: ArrowDownCircle,
  [TRANSACTION_TYPES.TRANSFER]: RefreshCw,
  [TRANSACTION_TYPES.ADJUSTMENT]: RefreshCw,
  [TRANSACTION_TYPES.PURCHASE]: ShoppingCart,
  [TRANSACTION_TYPES.REFUND]: TrendingUp,
  [TRANSACTION_TYPES.PAYMENT]: CreditCard,
  [TRANSACTION_TYPES.REWARD]: Gift,
  [TRANSACTION_TYPES.FEE]: Zap,
  [TRANSACTION_TYPES.COMMISSION]: Percent,
}

export default function WalletHistory() {
  const { currentWorkspaceId } = useWorkspace()
  const { i18n } = useTranslation()

  const [filterWalletType, setFilterWalletType] = useState('')
  const [filterTransactionType, setFilterTransactionType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    if (currency === 'IQD') {
      return i18n.language === 'ar' ? 'د.ع' : 'IQD'
    }
    return '$'
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.settings?.currency)

  const { data: historyData, isLoading } = useQuery({
    queryKey: [
      'walletHistory',
      filterWalletType,
      filterTransactionType,
      startDate,
      endDate,
      currentPage,
      pageSize,
    ],
    queryFn: () =>
      walletHistoryApi.getAll({
        walletType: filterWalletType ? (filterWalletType as 'custom' | 'user') : undefined,
        transactionType: filterTransactionType || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        pageSize,
      }),
  })

  const { data: stats } = useQuery({
    queryKey: ['walletHistory', 'stats', filterWalletType, startDate, endDate],
    queryFn: () =>
      walletHistoryApi.getStats({
        walletType: filterWalletType ? (filterWalletType as 'custom' | 'user') : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  })

  const history = historyData?.data || []
  const totalCount = historyData?.totalCount || 0
  const totalPages = historyData?.totalPages || 1

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-8 w-8" />
          Wallet History
        </h1>
        <p className="text-muted-foreground">
          Track all wallet transactions with before and after balances
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currencySymbol}
                {stats.totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Ups</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.TOP_UP)?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {currencySymbol}
                {(stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.TOP_UP)?.totalAmount || 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Wallet Type</Label>
              <Select value={filterWalletType} onValueChange={setFilterWalletType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="custom">Custom Wallet</SelectItem>
                  <SelectItem value="user">User Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select value={filterTransactionType} onValueChange={setFilterTransactionType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Transactions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Transactions</SelectItem>
                  {Object.entries(TRANSACTION_TYPE_INFO).map(([value, info]) => (
                    <SelectItem key={value} value={value}>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {(filterWalletType || filterTransactionType || startDate || endDate) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterWalletType('')
                  setFilterTransactionType('')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Showing {history.length} of {totalCount} transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No transaction history found
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => {
                    const typeInfo = TRANSACTION_TYPE_INFO[item.transactionType as TransactionType]
                    const IconComponent = transactionTypeIcons[item.transactionType as TransactionType] || ArrowUpCircle
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="text-sm">{formatDate(item.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="gap-1 w-fit">
                              <IconComponent className={`h-3 w-3 ${typeInfo?.color}`} />
                              {typeInfo?.label || item.transactionType}
                            </Badge>
                            <span className={`text-xs ${
                              item.amountType === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {item.amountType === 'credit' ? 'Credit' : 'Debit'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {item.walletType === 'custom'
                                ? item.customWalletName
                                : 'User Wallet'}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {item.walletType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.userName ? (
                            <div>
                              <div className="text-sm">{item.userName}</div>
                              <div className="text-xs text-muted-foreground">
                                {item.userEmail}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`${typeInfo?.color} font-medium`}>
                            {item.amountType === 'credit' ? '+' : '-'}
                            {currencySymbol}
                            {item.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {currencySymbol}
                          {item.balanceBefore.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {currencySymbol}
                          {item.balanceAfter.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            {item.reason && (
                              <div className="text-sm">{item.reason}</div>
                            )}
                            {item.reference && (
                              <div className="text-xs text-muted-foreground">
                                Ref: {item.reference}
                              </div>
                            )}
                            {!item.reason && !item.reference && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
