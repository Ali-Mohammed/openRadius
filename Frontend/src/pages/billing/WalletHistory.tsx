import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  History,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  ShoppingCart,
  CreditCard,
  Gift,
  Zap,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
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
  const [pageSize, setPageSize] = useState(50)
  const [showFilters, setShowFilters] = useState(false)

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    if (currency === 'IQD') {
      return i18n.language === 'ar' ? 'د.ع' : 'IQD'
    }
    return '$'
  }

  // Helper to format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Queries
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: historyData, isLoading, isFetching } = useQuery({
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

  const hasFilters = filterWalletType || filterTransactionType || startDate || endDate

  const clearFilters = () => {
    setFilterWalletType('')
    setFilterTransactionType('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-8 w-8" />
            Wallet History
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all wallet transactions with before and after balances
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-4">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
              </div>
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">
                  {currencySymbol} {formatCurrency(stats.totalAmount)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Top Ups</p>
                <p className="text-2xl font-bold">
                  {stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.TOP_UP)?.count || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currencySymbol} {formatCurrency(stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.TOP_UP)?.totalAmount || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Payments</p>
                <p className="text-2xl font-bold">
                  {stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.PAYMENT)?.count || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {currencySymbol} {formatCurrency(stats.byType.find((t) => t.transactionType === TRANSACTION_TYPES.PAYMENT)?.totalAmount || 0)}
                </p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-8"
              disabled
            />
          </div>
          {hasFilters && (
            <Badge variant="secondary" className="gap-1">
              <Filter className="h-3 w-3" />
              {[filterWalletType, filterTransactionType, startDate, endDate].filter(Boolean).length} active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1) }}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {}}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {hasFilters && (
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {[filterWalletType, filterTransactionType, startDate, endDate].filter(Boolean).length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Wallet Type</Label>
                    <Select value={filterWalletType || 'all'} onValueChange={(v) => { setFilterWalletType(v === 'all' ? '' : v); setCurrentPage(1) }}>
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
                    <Select value={filterTransactionType || 'all'} onValueChange={(v) => { setFilterTransactionType(v === 'all' ? '' : v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Transactions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Transactions</SelectItem>
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
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {!hasFilters && (
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Filters</h4>
                  </div>
                  <div className="space-y-2">
                    <Label>Wallet Type</Label>
                    <Select value={filterWalletType || 'all'} onValueChange={(v) => { setFilterWalletType(v === 'all' ? '' : v); setCurrentPage(1) }}>
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
                    <Select value={filterTransactionType || 'all'} onValueChange={(v) => { setFilterTransactionType(v === 'all' ? '' : v); setCurrentPage(1) }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Transactions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Transactions</SelectItem>
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
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-12 px-4 font-semibold">Date</TableHead>
              <TableHead className="h-12 px-4 font-semibold">Type</TableHead>
              <TableHead className="h-12 px-4 font-semibold">Wallet</TableHead>
              <TableHead className="h-12 px-4 font-semibold">User</TableHead>
              <TableHead className="h-12 px-4 font-semibold text-right">Amount</TableHead>
              <TableHead className="h-12 px-4 font-semibold text-right">Before</TableHead>
              <TableHead className="h-12 px-4 font-semibold text-right">After</TableHead>
              <TableHead className="h-12 px-4 font-semibold">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                </TableRow>
              ))
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <History className="h-12 w-12" />
                    <p className="text-lg font-medium">No transaction history found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              history.map((item) => {
                const typeInfo = TRANSACTION_TYPE_INFO[item.transactionType as TransactionType]
                const IconComponent = transactionTypeIcons[item.transactionType as TransactionType] || ArrowUpCircle
                return (
                  <TableRow key={item.id} className="hover:bg-muted/50">
                    <TableCell className="px-4">
                      <div className="text-sm font-medium">{formatDate(item.createdAt)}</div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="gap-1 w-fit">
                          <IconComponent className={`h-3 w-3 ${typeInfo?.color}`} />
                          {typeInfo?.label || item.transactionType}
                        </Badge>
                        <span className={`text-xs font-medium ${
                          item.amountType === 'credit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.amountType === 'credit' ? 'Credit' : 'Debit'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
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
                    <TableCell className="px-4">
                      {item.userName ? (
                        <div>
                          <div className="text-sm font-medium">{item.userName}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.userEmail}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <span className={`${typeInfo?.color} font-semibold`}>
                        {item.amountType === 'credit' ? '+' : '-'}
                        {currencySymbol} {formatCurrency(item.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-right text-muted-foreground">
                      {currencySymbol} {formatCurrency(item.balanceBefore)}
                    </TableCell>
                    <TableCell className="px-4 text-right font-medium">
                      {currencySymbol} {formatCurrency(item.balanceAfter)}
                    </TableCell>
                    <TableCell className="px-4">
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{history.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
          <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
          <span className="font-medium">{totalCount}</span> transactions
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm">
            <span className="font-medium">{currentPage}</span>
            <span className="text-muted-foreground">of</span>
            <span className="font-medium">{totalPages}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
