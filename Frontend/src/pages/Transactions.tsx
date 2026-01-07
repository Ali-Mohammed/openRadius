import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Receipt,
  Plus,
  Trash2,
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
  AlertCircle,
  RotateCcw,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import transactionApi, { type CreateTransactionRequest } from '@/api/transactions'
import { customWalletApi } from '@/api/customWallets'
import userWalletApi from '@/api/userWallets'
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

const statusColors = {
  completed: 'bg-green-100 text-green-800 border-green-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  reversed: 'bg-red-100 text-red-800 border-red-200',
}

export default function Transactions() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const { i18n } = useTranslation()

  const [filterWalletType, setFilterWalletType] = useState('')
  const [filterTransactionType, setFilterTransactionType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [includeDeleted, setIncludeDeleted] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [deletingTransaction, setDeletingTransaction] = useState<any>(null)
  const [restoringTransaction, setRestoringTransaction] = useState<any>(null)
  const [deleteReason, setDeleteReason] = useState('')

  const [formData, setFormData] = useState<CreateTransactionRequest>({
    walletType: 'custom',
    transactionType: TRANSACTION_TYPES.TOP_UP,
    amount: 0,
  })

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

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: [
      'transactions',
      filterWalletType,
      filterTransactionType,
      filterStatus,
      startDate,
      endDate,
      currentPage,
      pageSize,
      includeDeleted,
    ],
    queryFn: () =>
      transactionApi.getAll({
        walletType: filterWalletType ? (filterWalletType as 'custom' | 'user') : undefined,
        transactionType: filterTransactionType || undefined,
        status: filterStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        pageSize,
        includeDeleted,
      }),
  })

  const { data: stats } = useQuery({
    queryKey: ['transactions', 'stats', filterWalletType, startDate, endDate],
    queryFn: () =>
      transactionApi.getStats({
        walletType: filterWalletType ? (filterWalletType as 'custom' | 'user') : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  })

  const { data: customWallets } = useQuery({
    queryKey: ['customWallets', 'all'],
    queryFn: () => customWalletApi.getAll({ pageSize: 100 }),
    enabled: formData.walletType === 'custom' && isDialogOpen,
  })

  const { data: userWallets } = useQuery({
    queryKey: ['userWallets', 'all'],
    queryFn: () => userWalletApi.getAll({ pageSize: 100 }),
    enabled: formData.walletType === 'user' && isDialogOpen,
  })

  const transactions = transactionsData?.data || []
  const totalCount = transactionsData?.totalCount || 0
  const totalPages = transactionsData?.totalPages || 1

  // Mutations
  const createMutation = useMutation({
    mutationFn: transactionApi.create,
    onSuccess: () => {
      toast.success('Transaction created successfully')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to create transaction'
      toast.error(errorMessage)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => transactionApi.delete(id, reason),
    onSuccess: () => {
      toast.success('Transaction reversed successfully')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      setIsDeleteDialogOpen(false)
      setDeletingTransaction(null)
      setDeleteReason('')
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to reverse transaction'
      toast.error(errorMessage)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => transactionApi.restore(id),
    onSuccess: () => {
      toast.success('Transaction restored successfully')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      setIsRestoreDialogOpen(false)
      setRestoringTransaction(null)
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to restore transaction'
      toast.error(errorMessage)
    },
  })

  const resetForm = () => {
    setFormData({
      walletType: 'custom',
      transactionType: TRANSACTION_TYPES.TOP_UP,
      amount: 0,
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (formData.walletType === 'custom' && !formData.customWalletId) {
      toast.error('Please select a custom wallet')
      return
    }

    if (formData.walletType === 'user' && !formData.userWalletId) {
      toast.error('Please select a user wallet')
      return
    }

    createMutation.mutate(formData)
  }

  const handleDelete = () => {
    if (!deletingTransaction?.id) return
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deletion')
      return
    }
    deleteMutation.mutate({ id: deletingTransaction.id, reason: deleteReason })
  }

  const handleRestore = () => {
    if (!restoringTransaction?.id) return
    restoreMutation.mutate(restoringTransaction.id)
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-8 w-8" />
            Transactions
          </h1>
          <p className="text-muted-foreground">
            Manage all wallet transactions with automatic balance tracking
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Transaction
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {currencySymbol}
                {stats.totalCredit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {currencySymbol}
                {stats.totalDebit.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.netAmount >= 0 ? '+' : ''}
                {currencySymbol}
                {stats.netAmount.toFixed(2)}
              </div>
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
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Wallet Type</Label>
              <Select value={filterWalletType || "all"} onValueChange={(val) => setFilterWalletType(val === "all" ? "" : val)}>
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
              <Select value={filterTransactionType || "all"} onValueChange={(val) => setFilterTransactionType(val === "all" ? "" : val)}>
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
              <Label>Status</Label>
              <Select value={filterStatus || "all"} onValueChange={(val) => setFilterStatus(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
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

          {(filterWalletType || filterTransactionType || filterStatus || startDate || endDate) && (
            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFilterWalletType('')
                  setFilterTransactionType('')
                  setFilterStatus('')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="includeDeleted"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="includeDeleted" className="cursor-pointer">
              Show deleted transactions
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            Showing {transactions.length} of {totalCount} transactions
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
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((transaction) => {
                    const typeInfo = TRANSACTION_TYPE_INFO[transaction.transactionType as TransactionType]
                    const IconComponent = transactionTypeIcons[transaction.transactionType as TransactionType] || ArrowUpCircle
                    const isDeleted = transaction.isDeleted
                    return (
                      <TableRow key={transaction.id} className={isDeleted ? 'opacity-60 bg-gray-50' : ''}>
                        <TableCell>
                          <div className="text-sm">{formatDate(transaction.createdAt)}</div>
                          {isDeleted && (
                            <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <Trash2 className="h-3 w-3" />
                              Deleted
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="gap-1 w-fit">
                              <IconComponent className={`h-3 w-3 ${typeInfo?.color}`} />
                              {typeInfo?.label || transaction.transactionType}
                            </Badge>
                            <span className={`text-xs ${
                              transaction.amountType === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.amountType === 'credit' ? 'Credit' : 'Debit'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {transaction.walletType === 'custom'
                                ? transaction.customWalletName
                                : 'User Wallet'}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {transaction.walletType}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {transaction.userName ? (
                            <div>
                              <div className="text-sm">{transaction.userName}</div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.userEmail}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`${typeInfo?.color} font-medium`}>
                            {transaction.amountType === 'credit' ? '+' : '-'}
                            {currencySymbol}
                            {transaction.amount.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {currencySymbol}
                          {transaction.balanceBefore.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {currencySymbol}
                          {transaction.balanceAfter.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={statusColors[transaction.status]}>
                              {transaction.status}
                            </Badge>
                            {isDeleted && transaction.deletedAt && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(transaction.deletedAt)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isDeleted ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setRestoringTransaction(transaction)
                                setIsRestoreDialogOpen(true)
                              }}
                              title="Restore transaction"
                            >
                              <RotateCcw className="h-4 w-4 text-blue-600" />
                            </Button>
                          ) : transaction.status === 'completed' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingTransaction(transaction)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
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

      {/* Create Transaction Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Transaction</DialogTitle>
            <DialogDescription>
              Create a new transaction and update wallet balance
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="walletType">Wallet Type *</Label>
                <Select
                  value={formData.walletType}
                  onValueChange={(value: 'custom' | 'user') => {
                    setFormData({
                      ...formData,
                      walletType: value,
                      customWalletId: undefined,
                      userWalletId: undefined,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Custom Wallet</SelectItem>
                    <SelectItem value="user">User Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transactionType">Transaction Type *</Label>
                <Select
                  value={formData.transactionType}
                  onValueChange={(value: TransactionType) =>
                    setFormData({ ...formData, transactionType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSACTION_TYPE_INFO).map(([value, info]) => (
                      <SelectItem key={value} value={value}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.walletType === 'custom' ? (
              <div className="space-y-2">
                <Label htmlFor="customWallet">Custom Wallet *</Label>
                <Select
                  value={formData.customWalletId?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, customWalletId: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {customWallets?.data.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                        {wallet.name} - {currencySymbol}
                        {wallet.currentBalance.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="userWallet">User Wallet *</Label>
                <Select
                  value={formData.userWalletId?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, userWalletId: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {userWallets?.data.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                        {wallet.userName} - {currencySymbol}
                        {wallet.currentBalance.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ({currencySymbol}) *</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.amount || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Input
                  id="paymentMethod"
                  value={formData.paymentMethod || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentMethod: e.target.value })
                  }
                  placeholder="Cash, Card, Bank Transfer..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference Number</Label>
              <Input
                id="reference"
                value={formData.reference || ''}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
                placeholder="Transaction reference (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Transaction description (optional)"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={formData.reason || ''}
                onChange={(e) =>
                  setFormData({ ...formData, reason: e.target.value })
                }
                placeholder="Reason for transaction (optional)"
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Transaction'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Reverse Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the transaction and return the balance to the wallet. A
              reversal transaction will be created for audit purposes. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-2 py-4">
            <Label htmlFor="deleteReason">Reason for deletion *</Label>
            <Textarea
              id="deleteReason"
              placeholder="Please provide a reason for deleting this transaction..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={!deleteReason.trim() || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Reversing...' : 'Reverse Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-600" />
              Restore Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the transaction and adjust the wallet balance accordingly.
              The reversal transaction will be deleted. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? 'Restoring...' : 'Restore Transaction'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
