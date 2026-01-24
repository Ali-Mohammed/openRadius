import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  DollarSign,
  Check,
  X,
  ChevronsUpDown,
  RefreshCw,
  Download,
  Columns3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Wallet as WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ColorPicker } from '@/components/ColorPicker'
import { IconPicker } from '@/components/IconPicker'
import userWalletApi, { type UserWallet } from '@/api/userWallets'
import { userManagementApi } from '@/api/userManagementApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaceApi } from '@/lib/api'
import { useTranslation } from 'react-i18next'

// Import all icons for dynamic rendering
import {
  Wallet,
  CreditCard,
  TrendingUp,
  Gift,
  Coins,
  Banknote,
  PiggyBank,
} from 'lucide-react'

const iconMap: Record<string, typeof Wallet> = {
  Wallet,
  CreditCard,
  DollarSign,
  TrendingUp,
  Gift,
  Coins,
  Banknote,
  PiggyBank,
}

const statuses = [
  { value: 'active', label: 'Active', color: '#10b981' },
  { value: 'disabled', label: 'Disabled', color: '#6b7280' },
  { value: 'suspended', label: 'Suspended', color: '#f59e0b' },
]

// Column definitions
const COLUMN_DEFINITIONS = {
  user: { label: 'User', sortable: true, defaultWidth: 200 },
  wallet: { label: 'Wallet', sortable: false, defaultWidth: 120 },
  currentBalance: { label: 'Balance', sortable: true, defaultWidth: 140 },
  pendingCashback: { label: 'Pending Cashback', sortable: true, defaultWidth: 140 },
  maxFillLimit: { label: 'Max Fill', sortable: true, defaultWidth: 120 },
  dailySpendingLimit: { label: 'Daily Limit', sortable: true, defaultWidth: 120 },
  cashbackGroup: { label: 'Cashback Group', sortable: false, defaultWidth: 160 },
  customCashback: { label: 'Custom Cashback', sortable: false, defaultWidth: 180 },
  status: { label: 'Status', sortable: true, defaultWidth: 100 },
  allowOverdraft: { label: 'Allow Overdraft', sortable: true, defaultWidth: 130 },
  createdAt: { label: 'Created', sortable: true, defaultWidth: 120 },
}

const DEFAULT_COLUMN_VISIBILITY = {
  user: true,
  wallet: true,
  currentBalance: true,
  pendingCashback: true,
  maxFillLimit: true,
  dailySpendingLimit: true,
  cashbackGroup: true,
  customCashback: true,
  status: true,
  allowOverdraft: true,
  createdAt: false,
}

const DEFAULT_COLUMN_ORDER = ['user', 'wallet', 'currentBalance', 'pendingCashback', 'maxFillLimit', 'dailySpendingLimit', 'cashbackGroup', 'customCashback', 'status', 'allowOverdraft', 'createdAt', 'actions']

// Custom User Combobox Component
interface UserComboboxProps {
  users: Array<{ id: number; firstName?: string; lastName?: string; email?: string }>
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

function UserCombobox({ users, value, onValueChange, placeholder = 'Select a user' }: UserComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedUser = users.find((user) => user.id.toString() === value)

  const filteredUsers = useMemo(() => {
    if (!search) return users
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(search.toLowerCase()) ||
        user.firstName?.toLowerCase().includes(search.toLowerCase()) ||
        user.lastName?.toLowerCase().includes(search.toLowerCase())
    )
  }, [users, search])

  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 0)
    }
  }, [open])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSelect = (userId: string) => {
    onValueChange(userId)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {selectedUser ? (
          <div className="flex flex-col items-start text-left">
            <span className="font-medium">
              {selectedUser.firstName} {selectedUser.lastName}
            </span>
            <span className="text-xs text-muted-foreground">{selectedUser.email}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-100 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={searchInputRef}
              type="text"
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredUsers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No users found</div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSelect(user.id.toString())}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground ${
                    value === user.id.toString() ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex flex-1 flex-col items-start">
                    <span className="font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  {value === user.id.toString() && <Check className="ml-2 h-4 w-4" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserWallets() {
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const { i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Search and pagination state from URL
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '25'))
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '')

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<{
    user: boolean
    wallet: boolean
    currentBalance: boolean
    pendingCashback: boolean
    maxFillLimit: boolean
    dailySpendingLimit: boolean
    cashbackGroup: boolean
    customCashback: boolean
    status: boolean
    allowOverdraft: boolean
    createdAt: boolean
  }>(DEFAULT_COLUMN_VISIBILITY)
  const [columnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingWallet, setEditingWallet] = useState<UserWallet | null>(null)
  const [deletingWallet, setDeletingWallet] = useState<UserWallet | null>(null)

  const [formData, setFormData] = useState<Partial<UserWallet>>({
    userId: 0,
    currentBalance: 0,
    status: 'active',
    usesCustomCashbackSetting: false,
    customCashbackType: 'Instant',
    customCashbackCollectionSchedule: 'AnyTime',
  })

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 25) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    if (filterStatus) params.status = filterStatus
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, filterStatus, setSearchParams])

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

  const { data: walletsData, isLoading, isFetching } = useQuery({
    queryKey: [
      'userWallets',
      searchQuery,
      filterStatus,
      currentPage,
      pageSize,
    ],
    queryFn: () =>
      userWalletApi.getAll({
        search: searchQuery || undefined,
        status: filterStatus || undefined,
        page: currentPage,
        pageSize,
      }),
  })

  // Fetch users for the dropdown
  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => userManagementApi.getAll(),
    enabled: isDialogOpen,
  })

  const users = usersData || []

  // Filter and sort wallets locally for better UX
  const filteredWallets = useMemo(() => {
    const result = [...(walletsData?.data || [])]
    
    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal: string | number | boolean, bVal: string | number | boolean
        switch (sortField) {
          case 'user':
            aVal = (a.userName || '').toLowerCase()
            bVal = (b.userName || '').toLowerCase()
            break
          case 'currentBalance':
            aVal = a.currentBalance || 0
            bVal = b.currentBalance || 0
            break
          case 'maxFillLimit':
            aVal = a.maxFillLimit || 0
            bVal = b.maxFillLimit || 0
            break
          case 'dailySpendingLimit':
            aVal = a.dailySpendingLimit || 0
            bVal = b.dailySpendingLimit || 0
            break
          case 'status':
            aVal = (a.status || '').toLowerCase()
            bVal = (b.status || '').toLowerCase()
            break
          case 'allowOverdraft':
            aVal = a.allowNegativeBalance ? 1 : 0
            bVal = b.allowNegativeBalance ? 1 : 0
            break
          case 'createdAt':
            aVal = new Date(a.createdAt || 0).getTime()
            bVal = new Date(b.createdAt || 0).getTime()
            break
          default:
            return 0
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    
    return result
  }, [walletsData?.data, sortField, sortDirection])

  const totalCount = walletsData?.totalCount || 0
  const totalPages = walletsData?.totalPages || 1

  // Mutations
  const createMutation = useMutation({
    mutationFn: userWalletApi.create,
    onSuccess: () => {
      toast.success('User wallet created successfully')
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { error?: string; message?: string } } }) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to create user wallet'
      toast.error(errorMessage)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, wallet }: { id: number; wallet: Partial<UserWallet> }) =>
      userWalletApi.update(id, wallet),
    onSuccess: () => {
      toast.success('User wallet updated successfully')
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: Error & { response?: { data?: { error?: string; message?: string } } }) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to update user wallet'
      toast.error(errorMessage)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: userWalletApi.delete,
    onSuccess: () => {
      toast.success('User wallet deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      setIsDeleteDialogOpen(false)
      setDeletingWallet(null)
    },
    onError: () => {
      toast.error('Failed to delete user wallet')
    },
  })

  const resetForm = () => {
    setFormData({
      userId: 0,
      currentBalance: 0,
      status: 'active',
      usesCustomCashbackSetting: false,
      customCashbackType: 'Instant',
      customCashbackCollectionSchedule: 'AnyTime',
    })
    setEditingWallet(null)
  }

  const handleOpenDialog = (wallet?: UserWallet) => {
    if (wallet) {
      setEditingWallet(wallet)
      setFormData({
        userId: wallet.userId,
        currentBalance: wallet.currentBalance,
        maxFillLimit: wallet.maxFillLimit,
        dailySpendingLimit: wallet.dailySpendingLimit,
        status: wallet.status,
        customWalletColor: wallet.customWalletColor,
        customWalletIcon: wallet.customWalletIcon,
        allowNegativeBalance: wallet.allowNegativeBalance,
        usesCustomCashbackSetting: wallet.usesCustomCashbackSetting ?? false,
        customCashbackType: wallet.customCashbackType ?? 'Instant',
        customCashbackCollectionSchedule: wallet.customCashbackCollectionSchedule ?? 'AnyTime',
        customCashbackMinimumCollectionAmount: wallet.customCashbackMinimumCollectionAmount,
        customCashbackRequiresApproval: wallet.customCashbackRequiresApproval ?? false,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingWallet) {
      updateMutation.mutate({ id: editingWallet.id!, wallet: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = async () => {
    if (!deletingWallet?.id) return
    deleteMutation.mutate(deletingWallet.id)
  }

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const handleExportCsv = () => {
    const headers = ['User', 'Email', 'Balance', 'Pending Cashback', 'Max Fill', 'Daily Limit', 'Cashback Group', 'Custom Cashback', 'Status', 'Allow Overdraft', 'Created']
    const rows = filteredWallets.map(wallet => [
      wallet.userName || '',
      wallet.userEmail || '',
      wallet.currentBalance?.toString() || '0',
      wallet.pendingCashback?.toString() || '0',
      wallet.maxFillLimit?.toString() || '',
      wallet.dailySpendingLimit?.toString() || '',
      wallet.cashbackGroupName || '-',
      wallet.usesCustomCashbackSetting 
        ? `${wallet.customCashbackType || 'Instant'}${wallet.customCashbackType === 'Collected' && wallet.customCashbackRequiresApproval ? ' (Approval Required)' : ''}`
        : 'Global',
      wallet.status || '',
      wallet.allowNegativeBalance ? 'Yes' : 'No',
      wallet.createdAt ? new Date(wallet.createdAt).toLocaleDateString() : '',
    ])
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `user_wallets_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('User wallets exported to CSV')
  }

  // Generate pagination page numbers
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (current < total - 2) pages.push('...')
      pages.push(total)
    }
    return pages
  }, [])

  const getStatusColor = (status: string) => {
    return statuses.find((s) => s.value === status)?.color || '#6b7280'
  }

  // Render column header
  const renderColumnHeader = (column: string) => {
    if (column === 'actions') {
      return (
        <TableHead key={column} className="h-12 px-4 text-right sticky right-0 bg-muted z-10" style={{ width: 100 }}>
          Actions
        </TableHead>
      )
    }
    
    if (!columnVisibility[column as keyof typeof columnVisibility]) return null
    
    const def = COLUMN_DEFINITIONS[column as keyof typeof COLUMN_DEFINITIONS]
    if (!def) return null

    return (
      <TableHead 
        key={column} 
        className={`h-12 px-4 ${def.sortable ? 'cursor-pointer hover:bg-muted/80 select-none' : ''}`}
        style={{ width: def.defaultWidth }}
        onClick={def.sortable ? () => handleSort(column) : undefined}
      >
        <span className="flex items-center">
          {def.label}
          {def.sortable && getSortIcon(column)}
        </span>
      </TableHead>
    )
  }

  // Render table cell
  const renderTableCell = (column: string, wallet: UserWallet) => {
    if (column === 'actions') {
      return (
        <TableCell key={column} className="h-12 px-4 text-right sticky right-0 bg-background z-10">
          <div className="flex justify-end gap-1">
            <Button
              onClick={() => handleOpenDialog(wallet)}
              variant="ghost"
              size="icon"
              title="Edit wallet"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setDeletingWallet(wallet)
                setIsDeleteDialogOpen(true)
              }}
              variant="ghost"
              size="icon"
              title="Delete wallet"
            >
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        </TableCell>
      )
    }

    if (!columnVisibility[column as keyof typeof columnVisibility]) return null

    const IconComponent = wallet.customWalletIcon
      ? iconMap[wallet.customWalletIcon] || Wallet
      : Wallet

    switch (column) {
      case 'user':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div>
              <div className="font-medium">{wallet.userName}</div>
              <div className="text-sm text-muted-foreground">{wallet.userEmail}</div>
            </div>
          </TableCell>
        )
      case 'wallet':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: (wallet.customWalletColor || '#6366f1') + '20' }}
              >
                <IconComponent
                  className="h-4 w-4"
                  style={{ color: wallet.customWalletColor || '#6366f1' }}
                />
              </div>
              <span className="font-medium">Wallet</span>
            </div>
          </TableCell>
        )
      case 'currentBalance':
        return (
          <TableCell key={column} className="h-12 px-4 font-medium">
            <span className={wallet.currentBalance < 0 ? 'text-red-600' : ''}>
              {currencySymbol} {formatCurrency(wallet.currentBalance)}
            </span>
          </TableCell>
        )
      case 'pendingCashback':
        return (
          <TableCell key={column} className="h-12 px-4 font-medium">
            <span className={wallet.pendingCashback && wallet.pendingCashback > 0 ? 'text-orange-600' : 'text-muted-foreground'}>
              {wallet.pendingCashback && wallet.pendingCashback > 0
                ? `${currencySymbol} ${formatCurrency(wallet.pendingCashback)}`
                : '-'}
            </span>
          </TableCell>
        )
      case 'maxFillLimit':
        return (
          <TableCell key={column} className="h-12 px-4">
            {wallet.maxFillLimit !== null && wallet.maxFillLimit !== undefined
              ? `${currencySymbol} ${formatCurrency(wallet.maxFillLimit)}`
              : <span className="text-muted-foreground">-</span>}
          </TableCell>
        )
      case 'dailySpendingLimit':
        return (
          <TableCell key={column} className="h-12 px-4">
            {wallet.dailySpendingLimit !== null && wallet.dailySpendingLimit !== undefined
              ? `${currencySymbol} ${formatCurrency(wallet.dailySpendingLimit)}`
              : <span className="text-muted-foreground">-</span>}
          </TableCell>
        )
      case 'status':
        return (
          <TableCell key={column} className="h-12 px-4">
            <Badge
              style={{
                backgroundColor: getStatusColor(wallet.status) + '20',
                color: getStatusColor(wallet.status),
                borderColor: getStatusColor(wallet.status),
              }}
              variant="outline"
            >
              {wallet.status}
            </Badge>
          </TableCell>
        )
      case 'customCashback':
        return (
          <TableCell key={column} className="h-12 px-4">
            {wallet.usesCustomCashbackSetting ? (
              <div className="space-y-1">
                <Badge variant="outline" className="border-blue-600 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-400">
                  {wallet.customCashbackType || 'Instant'}
                </Badge>
                {wallet.customCashbackType === 'Collected' && (
                  <div className="text-xs text-muted-foreground">
                    {wallet.customCashbackRequiresApproval && '• Requires Approval'}
                    {wallet.customCashbackMinimumCollectionAmount && (
                      <div>• Min: {currencySymbol}{formatCurrency(wallet.customCashbackMinimumCollectionAmount)}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Badge variant="outline" className="border-gray-400 text-gray-600 bg-gray-50 dark:bg-gray-950 dark:text-gray-400">
                Global
              </Badge>
            )}
          </TableCell>
        )
      case 'cashbackGroup':
        return (
          <TableCell key={column} className="h-12 px-4">
            {wallet.cashbackGroupName ? (
              <Badge variant="outline" className="border-purple-600 text-purple-700 bg-purple-50 dark:bg-purple-950 dark:text-purple-400">
                {wallet.cashbackGroupName}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </TableCell>
        )
      case 'allowOverdraft':
        return (
          <TableCell key={column} className="h-12 px-4">
            {wallet.allowNegativeBalance ? (
              <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400">
                <Check className="h-3 w-3 mr-1" />
                Yes
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-600 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-400">
                <X className="h-3 w-3 mr-1" />
                No
              </Badge>
            )}
          </TableCell>
        )
      case 'createdAt':
        return (
          <TableCell key={column} className="h-12 px-4 text-muted-foreground">
            {wallet.createdAt ? new Date(wallet.createdAt).toLocaleDateString() : '-'}
          </TableCell>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header and Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">User Wallets</h1>
          <p className="text-sm text-muted-foreground">Manage user-specific wallet instances and balances</p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-1 flex-1">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-4 h-8 text-xs"
              />
            </form>
            
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('')
                  setSearchInput('')
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={(value) => {
              setFilterStatus(value === 'all' ? '' : value)
              setCurrentPage(1)
            }}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Export">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem onClick={handleExportCsv}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Column Visibility */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" title="Toggle columns">
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={columnVisibility[key as keyof typeof columnVisibility]}
                    onCheckedChange={(checked) => 
                      setColumnVisibility(prev => ({ ...prev, [key]: checked }))
                    }
                    onSelect={(e) => e.preventDefault()}
                  >
                    {def.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Refresh */}
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['userWallets'] })} 
              variant="outline" 
              size="icon"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>

            {/* Add Wallet */}
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Assign Wallet
            </Button>
          </div>
        </div>
      </div>

      {/* Wallets Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoading ? (
            <div className="overflow-auto">
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    {columnOrder.filter(c => c === 'actions' || columnVisibility[c as keyof typeof columnVisibility]).map(col => (
                      <TableHead key={col} className="h-12 px-4">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {columnOrder.filter(c => c === 'actions' || columnVisibility[c as keyof typeof columnVisibility]).map(col => (
                        <TableCell key={col} className="h-12 px-4">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredWallets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-3">
                <WalletIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold mb-1">
                {searchQuery || filterStatus ? 'No wallets found' : 'No user wallets yet'}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {searchQuery || filterStatus
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Get started by assigning a wallet to a user'}
              </p>
              {!searchQuery && !filterStatus && (
                <Button onClick={() => handleOpenDialog()} size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Assign Wallet
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-auto relative" style={{ maxHeight: 'calc(100vh - 212px)' }}>
              {isFetching && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <div className="bg-background p-4 rounded-lg shadow-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Refreshing...</span>
                    </div>
                  </div>
                </div>
              )}
              <Table className="table-fixed" style={{ width: '100%', minWidth: 'max-content' }}>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                    {columnOrder.map(column => renderColumnHeader(column))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWallets.map((wallet) => (
                    <TableRow key={wallet.id}>
                      {columnOrder.map(column => renderTableCell(column, wallet))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredWallets.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground whitespace-nowrap">Per page</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-muted-foreground font-medium">
                  Showing {totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} wallets
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPaginationPages(currentPage, totalPages).map((page, index) => (
                    typeof page === 'number' ? (
                      <Button
                        key={index}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="icon"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ) : (
                      <span key={index} className="px-1 text-muted-foreground">...</span>
                    )
                  ))}
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col">
          <div className="px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>
                {editingWallet ? 'Edit User Wallet' : 'Assign Wallet to User'}
              </DialogTitle>
              <DialogDescription>
                {editingWallet
                  ? 'Update wallet settings for this user'
                  : 'Assign a wallet type to a user'}
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="wallet-form" onSubmit={handleSubmit} className="space-y-4">
            {!editingWallet && (
              <div className="space-y-2">
                <Label htmlFor="userId">User *</Label>
                <UserCombobox
                  users={users}
                  value={formData.userId?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, userId: parseInt(value) })
                  }
                  placeholder="Select a user"
                />
              </div>
            )}

            {editingWallet && (
              <div className="space-y-2">
                <Label>User</Label>
                <div className="text-sm">
                  <div className="font-medium">{editingWallet.userName}</div>
                  <div className="text-muted-foreground">{editingWallet.userEmail}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxFillLimit">Max Fill ({currencySymbol})</Label>
                <Input
                  id="maxFillLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave empty for default"
                  value={formData.maxFillLimit ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxFillLimit: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailySpendingLimit">Daily Limit ({currencySymbol})</Label>
                <Input
                  id="dailySpendingLimit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Leave empty for default"
                  value={formData.dailySpendingLimit ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dailySpendingLimit: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ColorPicker
                value={formData.customWalletColor}
                onValueChange={(value) =>
                  setFormData({ ...formData, customWalletColor: value })
                }
                label="Wallet Color"
              />
              <IconPicker
                value={formData.customWalletIcon}
                onValueChange={(value) =>
                  setFormData({ ...formData, customWalletIcon: value })
                }
                label="Wallet Icon"
              />
            </div>

            {/* Custom Cashback Settings */}
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="usesCustomCashbackSetting" className="text-base font-semibold">
                    Custom Cashback Settings
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Override global cashback settings for this wallet
                  </p>
                </div>
                <Switch
                  id="usesCustomCashbackSetting"
                  checked={formData.usesCustomCashbackSetting ?? false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, usesCustomCashbackSetting: checked })
                  }
                />
              </div>

              {formData.usesCustomCashbackSetting && (
                <div className="space-y-4 pl-4 border-l-2">
                  <div className="space-y-2">
                    <Label htmlFor="customCashbackType">Cashback Type *</Label>
                    <Select
                      value={formData.customCashbackType || 'Instant'}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customCashbackType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Instant">Instant - Credit immediately</SelectItem>
                        <SelectItem value="Collected">Collected - Requires collection</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.customCashbackType === 'Collected' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="customCashbackCollectionSchedule">Collection Schedule</Label>
                        <Select
                          value={formData.customCashbackCollectionSchedule || 'AnyTime'}
                          onValueChange={(value) =>
                            setFormData({ ...formData, customCashbackCollectionSchedule: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AnyTime">Any Time</SelectItem>
                            <SelectItem value="EndOfWeek">End of Week</SelectItem>
                            <SelectItem value="EndOfMonth">End of Month</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="customCashbackMinimumCollectionAmount">
                          Minimum Collection Amount ({currencySymbol})
                        </Label>
                        <Input
                          id="customCashbackMinimumCollectionAmount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g., 100.00"
                          value={formData.customCashbackMinimumCollectionAmount ?? ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              customCashbackMinimumCollectionAmount:
                                e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="customCashbackRequiresApproval"
                          checked={formData.customCashbackRequiresApproval ?? false}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              customCashbackRequiresApproval: checked as boolean,
                            })
                          }
                        />
                        <Label htmlFor="customCashbackRequiresApproval" className="font-normal cursor-pointer">
                          Requires supervisor approval to collect
                        </Label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="allowNegativeBalance"
                checked={formData.allowNegativeBalance ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allowNegativeBalance: checked as boolean })
                }
              />
              <Label htmlFor="allowNegativeBalance" className="font-normal cursor-pointer">
                Allow overdraft (negative balance)
              </Label>
            </div>

            </form>
          </div>
          
          <div className="px-6 py-4 border-t bg-background">
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                form="wallet-form"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editingWallet ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the wallet for <strong>{deletingWallet?.userName}</strong>? 
              The current balance ({currencySymbol} {formatCurrency(deletingWallet?.currentBalance || 0)}) will be lost. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Wallet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
