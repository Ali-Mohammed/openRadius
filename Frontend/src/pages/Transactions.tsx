import { useCallback, useState } from 'react'
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
  Search,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  MessageSquare,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import transactionApi, { type CreateTransactionRequest } from '@/api/transactions'
import { customWalletApi } from '@/api/customWallets'
import userWalletApi from '@/api/userWallets'
import { workspaceApi } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { TRANSACTION_TYPES, TRANSACTION_TYPE_INFO, type TransactionType } from '@/constants/transactionTypes'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { TransactionCommentsDialog } from '@/components/TransactionCommentsDialog'
import { TransactionHistoryDialog } from '@/components/TransactionHistoryDialog'

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
  const { i18n } = useTranslation()
  const { currentWorkspaceId } = useWorkspace()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [showTrash, setShowTrash] = useState(false)
  const [columnVisibility, setColumnVisibility] = useState({
    date: true,
    type: true,
    wallet: true,
    user: true,
    radiusUsername: true,
    radiusProfile: true,
    billingProfile: true,
    amount: true,
    before: true,
    after: true,
    status: true,
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null)
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([])
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkRestoreDialogOpen, setIsBulkRestoreDialogOpen] = useState(false)
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

  // Helper to format currency amounts
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  // Get workspace for currency settings
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  })

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: transactionsData, isLoading, isFetching } = useQuery({
    queryKey: [
      'transactions',
      currentPage,
      pageSize,
      showTrash,
    ],
    queryFn: async () => {
      const result = await transactionApi.getAll({
        page: currentPage,
        pageSize,
        includeDeleted: showTrash,
      })
      return result
    },
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

  // Generate pagination page numbers (same as RadiusUsers)
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7 // Total number of page buttons to show
    
    if (total <= maxVisible) {
      // Show all pages if total is small
      for (let i = 1; i <= total; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (current > 3) {
        pages.push('...')
      }
      
      // Show pages around current
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i)
        }
      }
      
      if (current < total - 2) {
        pages.push('...')
      }
      
      // Always show last page
      if (!pages.includes(total)) {
        pages.push(total)
      }
    }
    
    return pages
  }, [])

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

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
    onSuccess: async () => {
      toast.success('Transaction reversed successfully')
      // Refetch to immediately update the UI
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
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
    onSuccess: async () => {
      toast.success('Transaction restored successfully')
      // Refetch to immediately update the UI
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
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

  const bulkDeleteMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: number[]; reason?: string }) => 
      transactionApi.bulkDelete(ids, reason),
    onSuccess: async (data: any) => {
      const successCount = data.results?.length || 0
      const errorCount = data.errors?.length || 0
      
      if (successCount > 0) {
        toast.success(`${successCount} transaction(s) reversed successfully`)
      }
      if (errorCount > 0) {
        toast.error(`Failed to reverse ${errorCount} transaction(s)`)
        console.error('Bulk delete errors:', data.errors)
      }
      
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      setIsBulkDeleteDialogOpen(false)
      setSelectedTransactions([])
      setDeleteReason('')
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to reverse transactions'
      toast.error(errorMessage)
    },
  })

  const bulkRestoreMutation = useMutation({
    mutationFn: (ids: number[]) => transactionApi.bulkRestore(ids),
    onSuccess: async (data: any) => {
      const successCount = data.results?.length || 0
      const errorCount = data.errors?.length || 0
      
      if (successCount > 0) {
        toast.success(`${successCount} transaction(s) restored successfully`)
      }
      if (errorCount > 0) {
        toast.error(`Failed to restore ${errorCount} transaction(s)`)
        console.error('Bulk restore errors:', data.errors)
      }
      
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      await queryClient.invalidateQueries({ queryKey: ['walletHistory'] })
      setIsBulkRestoreDialogOpen(false)
      setSelectedTransactions([])
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to restore transactions'
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

  const handleBulkDelete = () => {
    if (selectedTransactions.length === 0) return
    if (!deleteReason.trim()) {
      toast.error('Please provide a reason for deletion')
      return
    }
    bulkDeleteMutation.mutate({ ids: selectedTransactions, reason: deleteReason })
  }

  const handleBulkRestore = () => {
    if (selectedTransactions.length === 0) return
    bulkRestoreMutation.mutate(selectedTransactions)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTransactions(transactions.map(t => t.id))
    } else {
      setSelectedTransactions([])
    }
  }

  const handleSelectTransaction = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedTransactions(prev => [...prev, id])
    } else {
      setSelectedTransactions(prev => prev.filter(tid => tid !== id))
    }
  }

  const isAllSelected = transactions.length > 0 && selectedTransactions.length === transactions.length
  const isSomeSelected = selectedTransactions.length > 0 && selectedTransactions.length < transactions.length

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all wallet transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowTrash(!showTrash)}
            variant={showTrash ? 'default' : 'outline'}
            size="sm"
          >
            <Archive className="mr-2 h-4 w-4" />
            {showTrash ? 'Active' : 'Trash'}
          </Button>
          
          {/* Bulk Actions */}
          {selectedTransactions.length > 0 && (
            <>
              <Button
                onClick={() => setIsBulkDeleteDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedTransactions.length})
              </Button>
              <Button
                onClick={() => setIsBulkRestoreDialogOpen(true)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Restore ({selectedTransactions.length})
              </Button>
            </>
          )}

          {!showTrash && (
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area - Card wrapping table and pagination */}
      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={columnVisibility.date}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, date: checked }))}
              >
                Date
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.type}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, type: checked }))}
              >
                Type
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.wallet}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, wallet: checked }))}
              >
                Wallet
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.user}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, user: checked }))}
              >
                User
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.radiusUsername}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, radiusUsername: checked }))}
              >
                RADIUS Username
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.radiusProfile}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, radiusProfile: checked }))}
              >
                RADIUS Profile
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.billingProfile}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, billingProfile: checked }))}
              >
                Billing Profile
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.amount}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, amount: checked }))}
              >
                Amount
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.before}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, before: checked }))}
              >
                Balance Before
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.after}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, after: checked }))}
              >
                Balance After
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columnVisibility.status}
                onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, status: checked }))}
              >
                Status
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1) }}>
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
            onClick={() => queryClient.invalidateQueries({ queryKey: ['transactions'] })}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-9 px-2 w-[40px] text-xs font-medium">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className={`h-4 w-4 ${isSomeSelected && !isAllSelected ? "data-[state=checked]:bg-primary/50" : ""}`}
                />
              </TableHead>
              {columnVisibility.date && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Date</TableHead>}
              {columnVisibility.type && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Type</TableHead>}
              {columnVisibility.wallet && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Wallet</TableHead>}
              {columnVisibility.user && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">User</TableHead>}
              {columnVisibility.radiusUsername && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Username</TableHead>}
              {columnVisibility.radiusProfile && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Profile</TableHead>}
              {columnVisibility.billingProfile && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Billing</TableHead>}
              {columnVisibility.amount && <TableHead className="h-9 px-2 text-xs font-medium text-right whitespace-nowrap">Amount</TableHead>}
              {columnVisibility.before && <TableHead className="h-9 px-2 text-xs font-medium text-right whitespace-nowrap">Before</TableHead>}
              {columnVisibility.after && <TableHead className="h-9 px-2 text-xs font-medium text-right whitespace-nowrap">After</TableHead>}
              {columnVisibility.status && <TableHead className="h-9 px-2 text-xs font-medium whitespace-nowrap">Status</TableHead>}
              <TableHead className="h-9 px-2 text-xs font-medium text-right sticky right-0 bg-muted/50">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="h-9">
                  <TableCell className="px-2 py-1"><Skeleton className="h-3 w-4" /></TableCell>
                  {columnVisibility.date && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-20" /></TableCell>}
                  {columnVisibility.type && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-16" /></TableCell>}
                  {columnVisibility.wallet && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-20" /></TableCell>}
                  {columnVisibility.user && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-24" /></TableCell>}
                  {columnVisibility.radiusUsername && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-20" /></TableCell>}
                  {columnVisibility.radiusProfile && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-20" /></TableCell>}
                  {columnVisibility.billingProfile && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-20" /></TableCell>}
                  {columnVisibility.amount && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-16" /></TableCell>}
                  {columnVisibility.before && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-16" /></TableCell>}
                  {columnVisibility.after && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-16" /></TableCell>}
                  {columnVisibility.status && <TableCell className="px-2 py-1"><Skeleton className="h-3 w-14" /></TableCell>}
                  <TableCell className="px-2 py-1"><Skeleton className="h-3 w-16" /></TableCell>
                </TableRow>
              ))
) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8">
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    {showTrash ? (
                      <>
                        <Archive className="h-8 w-8" />
                        <p className="text-sm font-medium">No deleted transactions</p>
                        <p className="text-xs">Deleted transactions will appear here</p>
                      </>
                    ) : (
                      <>
                        <Receipt className="h-8 w-8" />
                        <p className="text-sm font-medium">No transactions found</p>
                        <p className="text-xs">Create your first transaction to get started</p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction) => {
                const typeInfo = TRANSACTION_TYPE_INFO[transaction.transactionType as TransactionType]
                const IconComponent = transactionTypeIcons[transaction.transactionType as TransactionType] || ArrowUpCircle
                const isDeleted = transaction.isDeleted
                const isSelected = selectedTransactions.includes(transaction.id)
                return (
                  <TableRow key={transaction.id} className={`hover:bg-muted/50 h-9 ${isDeleted ? 'opacity-60 bg-gray-50' : ''}`}>
                        <TableCell className="px-2 py-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSelectTransaction(transaction.id, checked as boolean)}
                            aria-label={`Select transaction ${transaction.id}`}
                            className="h-4 w-4"
                          />
                        </TableCell>
                        {columnVisibility.date && (
                          <TableCell className="px-2 py-1 whitespace-nowrap">
                            <span className="text-xs">{formatDate(transaction.createdAt)}</span>
                            {isDeleted && (
                              <span className="text-[10px] text-red-600 ml-1">
                                <Trash2 className="h-2.5 w-2.5 inline" />
                              </span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.type && (
                          <TableCell className="px-2 py-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="gap-0.5 text-[10px] px-1.5 py-0 h-5">
                                <IconComponent className={`h-2.5 w-2.5 ${typeInfo?.color}`} />
                                {typeInfo?.label || transaction.transactionType}
                              </Badge>
                              <span className={`text-[10px] ${transaction.amountType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                {transaction.amountType === 'credit' ? '+' : '-'}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        {columnVisibility.wallet && (
                          <TableCell className="px-2 py-1">
                            <div className="text-xs font-medium truncate max-w-[100px]" title={transaction.walletType === 'custom' ? transaction.customWalletName : 'User Wallet'}>
                              {transaction.walletType === 'custom' ? transaction.customWalletName : 'User Wallet'}
                            </div>
                          </TableCell>
                        )}
                        {columnVisibility.user && (
                          <TableCell className="px-2 py-1">
                            {transaction.userName ? (
                              <span className="text-xs truncate max-w-[80px] block" title={transaction.userName}>{transaction.userName}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.radiusUsername && (
                          <TableCell className="px-2 py-1">
                            {transaction.radiusUsername ? (
                              <span className="text-xs font-medium">{transaction.radiusUsername}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.radiusProfile && (
                          <TableCell className="px-2 py-1">
                            {transaction.radiusProfileName ? (
                              <span className="text-xs">{transaction.radiusProfileName}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.billingProfile && (
                          <TableCell className="px-2 py-1">
                            {transaction.billingProfileName ? (
                              <span className="text-xs">{transaction.billingProfileName}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                        {columnVisibility.amount && (
                          <TableCell className="px-2 py-1 text-right">
                            <span className={`text-xs font-medium ${typeInfo?.color}`}>
                              {transaction.amountType === 'credit' ? '+' : '-'}{currencySymbol} {formatCurrency(transaction.amount)}
                            </span>
                          </TableCell>
                        )}
                        {columnVisibility.before && (
                          <TableCell className="px-2 py-1 text-right">
                            <span className="text-xs text-muted-foreground">{currencySymbol} {formatCurrency(transaction.balanceBefore)}</span>
                          </TableCell>
                        )}
                        {columnVisibility.after && (
                          <TableCell className="px-2 py-1 text-right">
                            <span className="text-xs font-medium">{currencySymbol} {formatCurrency(transaction.balanceAfter)}</span>
                          </TableCell>
                        )}
                        {columnVisibility.status && (
                          <TableCell className="px-2 py-1">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[transaction.status]}`}>
                              {transaction.status}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="sticky right-0 bg-background px-2 py-1 text-right">
                          <div className="flex items-center justify-end gap-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSelectedTransactionId(transaction.id!)
                                setIsCommentsDialogOpen(true)
                              }}
                              title="Comments"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                setSelectedTransactionId(transaction.id)
                                setIsHistoryDialogOpen(true)
                              }}
                              title="History"
                            >
                              <History className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            {isDeleted ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setRestoringTransaction(transaction)
                                  setIsRestoreDialogOpen(true)
                                }}
                                title="Restore"
                              >
                                <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            ) : transaction.status === 'completed' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setDeletingTransaction(transaction)
                                  setIsDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
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
          Showing <span className="font-medium">{transactions.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{' '}
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
                        {wallet.currentBalance?.toFixed(2) || '0.00'}
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

      {/* Transaction Comments Dialog */}
      {selectedTransactionId && (
        <TransactionCommentsDialog
          open={isCommentsDialogOpen}
          onOpenChange={setIsCommentsDialogOpen}
          transactionId={selectedTransactionId}
        />
      )}

      {/* Transaction History Dialog */}
      {selectedTransactionId && (
        <TransactionHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          transactionId={selectedTransactionId}
        />
      )}

      {/* Bulk Delete Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTransactions.length} Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse the selected transactions and adjust wallet balances accordingly.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="my-4">
            <Label htmlFor="bulk-delete-reason">Reason for deletion *</Label>
            <Textarea
              id="bulk-delete-reason"
              placeholder="Enter reason for deletion..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending || !deleteReason.trim()}
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedTransactions.length} Transactions`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Restore Dialog */}
      <AlertDialog open={isBulkRestoreDialogOpen} onOpenChange={setIsBulkRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {selectedTransactions.length} Transactions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the selected transactions and adjust wallet balances accordingly.
              The reversal transactions will be deleted. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkRestore}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={bulkRestoreMutation.isPending}
            >
              {bulkRestoreMutation.isPending ? 'Restoring...' : `Restore ${selectedTransactions.length} Transactions`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
