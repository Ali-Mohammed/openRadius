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
  Archive,
  RefreshCw,
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
  const [editingWallet, setEditingWallet] = useState<UserWallet | null>(null)
  const [deletingWallet, setDeletingWallet] = useState<UserWallet | null>(null)

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

  const resetForm = () => {
    setFormData({
      userId: 0,
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
        currentBalance: wallet.currentBalance,
        maxFillLimit: wallet.maxFillLimit,
        dailySpendingLimit: wallet.dailySpendingLimit,
        status: wallet.status,
        customWalletColor: wallet.customWalletColor,
        customWalletIcon: wallet.customWalletIcon,
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



  const getStatusColor = (status: string) => {
    return statuses.find((s) => s.value === status)?.color || '#6b7280'
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Wallets</h1>
          <p className="text-sm text-muted-foreground">Manage user-specific wallet instances and balances</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search by user or wallet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => setSearchTerm(searchTerm)} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['user-wallets'] })} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
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
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Assign Wallet
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Wallet</TableHead>
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
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : wallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
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
                    <TableCell className="font-medium">
                      {currencySymbol} {formatCurrency(wallet.currentBalance)}
                    </TableCell>
                    <TableCell>
                      {wallet.maxFillLimit !== null && wallet.maxFillLimit !== undefined
                        ? `${currencySymbol} ${formatCurrency(wallet.maxFillLimit)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {wallet.dailySpendingLimit !== null && wallet.dailySpendingLimit !== undefined
                        ? `${currencySymbol} ${formatCurrency(wallet.dailySpendingLimit)}`
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
        </CardContent>
      </Card>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the wallet for user "{deletingWallet?.userName}". The current
              balance ({currencySymbol} {formatCurrency(deletingWallet?.currentBalance || 0)}) will be lost. This action cannot
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
