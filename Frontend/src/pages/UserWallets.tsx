import { useState, useRef, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  DollarSign,
  Check,
  X,
  ChevronsUpDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Combobox } from '@/components/ui/combobox'
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
        <div className="absolute z-[100] mt-1 w-full rounded-md border bg-popover shadow-md">
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
          <div className="max-h-[300px] overflow-y-auto p-1">
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

  const [searchTerm, setSearchTerm] = useState('')
  const [filterUserId, setFilterUserId] = useState<number | undefined>()
  const [filterStatus, setFilterStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isAdjustBalanceDialogOpen, setIsAdjustBalanceDialogOpen] = useState(false)
  const [editingWallet, setEditingWallet] = useState<UserWallet | null>(null)
  const [deletingWallet, setDeletingWallet] = useState<UserWallet | null>(null)
  const [adjustingWallet, setAdjustingWallet] = useState<UserWallet | null>(null)
  const [balanceAdjustment, setBalanceAdjustment] = useState({ amount: 0, reason: '' })

  const [formData, setFormData] = useState<Partial<UserWallet>>({
    userId: 0,
    currentBalance: 0,
    status: 'active',
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

  const currencySymbol = getCurrencySymbol(workspace?.currency)

  const { data: walletsData, isLoading } = useQuery({
    queryKey: [
      'userWallets',
      searchTerm,
      filterUserId,
      filterStatus,
      currentPage,
      pageSize,
    ],
    queryFn: () =>
      userWalletApi.getAll({
        search: searchTerm || undefined,
        userId: filterUserId,
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

  const wallets = walletsData?.data || []
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
    onError: (error: any) => {
      console.error('Create wallet error:', error)
      console.error('Error response:', error?.response?.data)
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
    onError: (error: any) => {
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
    onError: (error) => {
      console.error('Error deleting user wallet:', error)
      toast.error('Failed to delete user wallet')
    },
  })

  const adjustBalanceMutation = useMutation({
    mutationFn: ({ id, adjustment }: { id: number; adjustment: { amount: number; reason?: string } }) =>
      userWalletApi.adjustBalance(id, adjustment),
    onSuccess: (data) => {
      toast.success(`Balance adjusted: ${currencySymbol}${data.adjustment.toFixed(2)}`)
      queryClient.invalidateQueries({ queryKey: ['userWallets'] })
      setIsAdjustBalanceDialogOpen(false)
      setAdjustingWallet(null)
      setBalanceAdjustment({ amount: 0, reason: '' })
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to adjust balance'
      toast.error(errorMessage)
    },
  })

  const resetForm = () => {
    setFormData({
      userId: 0,
      customWalletId: 0,
      currentBalance: 0,
      status: 'active',
    })
    setEditingWallet(null)
  }

  const handleOpenDialog = (wallet?: UserWallet) => {
    if (wallet) {
      setEditingWallet(wallet)
      setFormData({
        userId: wallet.userId,
        customWalletId: wallet.customWalletId,
        currentBalance: wallet.currentBalance,
        maxFillLimit: wallet.maxFillLimit,
        dailySpendingLimit: wallet.dailySpendingLimit,
        status: wallet.status,
        allowNegativeBalance: wallet.allowNegativeBalance,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    console.log('Submitting form data:', formData)

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

  const handleAdjustBalance = () => {
    if (!adjustingWallet?.id) return
    adjustBalanceMutation.mutate({
      id: adjustingWallet.id,
      adjustment: balanceAdjustment,
    })
  }

  const getStatusColor = (status: string) => {
    return statuses.find((s) => s.value === status)?.color || '#6b7280'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Wallets</h1>
          <p className="text-muted-foreground">
            Manage user-specific wallet instances and balances
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Assign Wallet to User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or wallet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-[200px] flex gap-2">
          <Select value={filterWalletType} onValueChange={setFilterWalletType}>
            <SelectTrigger>
              <SelectValue placeholder="Wallet Type" />
            </SelectTrigger>
            <SelectContent>
              {customWallets?.data.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                  {wallet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterWalletType && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFilterWalletType('')}
              className="h-10 w-10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="w-[200px] flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterStatus && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFilterStatus('')}
              className="h-10 w-10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Wallet</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current Balance</TableHead>
              <TableHead>Max Fill</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Allow Overdraft</TableHead>
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
            ) : wallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No user wallets found
                </TableCell>
              </TableRow>
            ) : (
              wallets.map((wallet) => {
                const IconComponent = wallet.customWalletIcon
                  ? iconMap[wallet.customWalletIcon] || Wallet
                  : Wallet
                return (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{wallet.userName}</div>
                        <div className="text-sm text-muted-foreground">{wallet.userEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: wallet.customWalletColor + '20' }}
                        >
                          <IconComponent
                            className="h-4 w-4"
                            style={{ color: wallet.customWalletColor }}
                          />
                        </div>
                        <span className="font-medium">{wallet.customWalletName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{wallet.customWalletType}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {currencySymbol}
                      {wallet.currentBalance.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {wallet.maxFillLimit !== null && wallet.maxFillLimit !== undefined
                        ? `${currencySymbol}${wallet.maxFillLimit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {wallet.dailySpendingLimit !== null && wallet.dailySpendingLimit !== undefined
                        ? `${currencySymbol}${wallet.dailySpendingLimit.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      {wallet.allowNegativeBalance ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAdjustingWallet(wallet)
                            setIsAdjustBalanceDialogOpen(true)
                          }}
                          title="Adjust Balance"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(wallet)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeletingWallet(wallet)
                            setIsDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} wallets
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingWallet && (
              <>
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
              </>
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
                      maxFillLimit: e.target.value !== '' ? parseFloat(e.target.value) : null,
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
                      dailySpendingLimit: e.target.value !== '' ? parseFloat(e.target.value) : null,
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

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="allowNegativeBalance"
                checked={formData.allowNegativeBalance ?? false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, allowNegativeBalance: checked as boolean })
                }
              />
              <Label htmlFor="allowNegativeBalance" className="font-normal cursor-pointer">
                Override: Allow negative balance
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingWallet ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={isAdjustBalanceDialogOpen} onOpenChange={setIsAdjustBalanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
            <DialogDescription>
              Current balance: {currencySymbol}
              {adjustingWallet?.currentBalance.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount ({currencySymbol}) - Use negative to deduct
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={balanceAdjustment.amount}
                onChange={(e) =>
                  setBalanceAdjustment({
                    ...balanceAdjustment,
                    amount: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="e.g., 100 or -50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={balanceAdjustment.reason}
                onChange={(e) =>
                  setBalanceAdjustment({ ...balanceAdjustment, reason: e.target.value })
                }
                placeholder="e.g., Monthly top-up"
              />
            </div>
            {balanceAdjustment.amount !== 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  New balance will be:{' '}
                  <span className="font-bold">
                    {currencySymbol}
                    {((adjustingWallet?.currentBalance || 0) + balanceAdjustment.amount).toFixed(
                      2
                    )}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAdjustBalanceDialogOpen(false)
                setBalanceAdjustment({ amount: 0, reason: '' })
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAdjustBalance} disabled={balanceAdjustment.amount === 0}>
              Adjust Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the wallet for user "{deletingWallet?.userName}". The current
              balance ({currencySymbol}
              {deletingWallet?.currentBalance.toFixed(2)}) will be lost. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
