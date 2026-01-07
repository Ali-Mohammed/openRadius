import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Wallet, Edit, Trash2 } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { customWalletApi, type CustomWallet } from '@/api/customWallets'

const iconOptions = [
  { value: 'Wallet', label: 'Wallet' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'DollarSign', label: 'Dollar Sign' },
  { value: 'TrendingUp', label: 'Trending Up' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Coins', label: 'Coins' },
  { value: 'Banknote', label: 'Banknote' },
  { value: 'PiggyBank', label: 'Piggy Bank' },
]

const colorOptions = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#10b981', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
]

export default function CustomWallets() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingWallet, setEditingWallet] = useState<CustomWallet | null>(null)
  const [deletingWallet, setDeletingWallet] = useState<CustomWallet | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(10)
  const [draggedItem, setDraggedItem] = useState<CustomWallet | null>(null)
  const [dragOverItem, setDragOverItem] = useState<CustomWallet | null>(null)

  const [formData, setFormData] = useState<CustomWallet>({
    name: '',
    description: '',
    maxFillLimit: 0,
    dailySpendingLimit: 0,
    type: 'spending',
    status: 'active',
    color: '#ef4444',
    icon: 'Wallet',
  })

  // Queries
  const { data: walletsData, isLoading } = useQuery({
    queryKey: ['customWallets', searchTerm, filterType, filterStatus, currentPage, pageSize],
    queryFn: () =>
      customWalletApi.getAll({
        search: searchTerm || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
        page: currentPage,
        pageSize,
      }),
  })

  const { data: types = [] } = useQuery({
    queryKey: ['customWalletTypes'],
    queryFn: () => customWalletApi.getTypes(),
  })

  const { data: statuses = [] } = useQuery({
    queryKey: ['customWalletStatuses'],
    queryFn: () => customWalletApi.getStatuses(),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: customWalletApi.create,
    onSuccess: () => {
      toast.success('Custom wallet created successfully')
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      handleCloseDialog()
    },
    onError: (error) => {
      console.error('Error creating custom wallet:', error)
      const errorMessage = (error as any)?.response?.data?.error || 'Failed to create custom wallet'
      toast.error(errorMessage)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, wallet }: { id: number; wallet: CustomWallet }) =>
      customWalletApi.update(id, wallet),
    onSuccess: () => {
      toast.success('Custom wallet updated successfully')
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      handleCloseDialog()
    },
    onError: (error) => {
      console.error('Error updating custom wallet:', error)
      const errorMessage = (error as any)?.response?.data?.error || 'Failed to update custom wallet'
      toast.error(errorMessage)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: customWalletApi.delete,
    onSuccess: () => {
      toast.success('Custom wallet deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['customWallets'] })
      setIsDeleteDialogOpen(false)
      setDeletingWallet(null)
    },
    onError: (error) => {
      console.error('Error deleting custom wallet:', error)
      toast.error('Failed to delete custom wallet')
    },
  })

  const wallets = walletsData?.data || []
  const totalCount = walletsData?.totalCount || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const handleOpenDialog = (wallet?: CustomWallet) => {
    if (wallet) {
      setEditingWallet(wallet)
      setFormData(wallet)
    } else {
      setEditingWallet(null)
      setFormData({
        name: '',
        description: '',
        maxFillLimit: 0,
        dailySpendingLimit: 0,
        type: 'spending',
        status: 'active',
        color: '#ef4444',
        icon: 'Wallet',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingWallet(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check for duplicate name (case-insensitive)
    const duplicateName = wallets.find(
      (w) =>
        w.name.toLowerCase() === formData.name.toLowerCase() &&
        w.id !== editingWallet?.id
    )
    
    if (duplicateName) {
      toast.error('A custom wallet with this name already exists')
      return
    }
    
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

  const getTypeInfo = (type: string) => {
    return types.find((t) => t.value === type)
  }

  const getStatusColor = (status: string) => {
    const statusInfo = statuses.find((s) => s.value === status)
    return statusInfo?.color || '#6b7280'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Wallets</h1>
          <p className="text-muted-foreground">
            Manage dynamic wallet types for your billing system
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Wallet
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search wallets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterType || undefined} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {types.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterType && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterType('')}
              className="h-8"
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterStatus || undefined} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
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
              size="sm"
              onClick={() => setFilterStatus('')}
              className="h-8"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Max Fill Limit</TableHead>
              <TableHead>Daily Limit</TableHead>
              <TableHead>Current Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : wallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  No custom wallets found
                </TableCell>
              </TableRow>
            ) : (
              wallets.map((wallet) => {
                const typeInfo = getTypeInfo(wallet.type)
                return (
                  <TableRow key={wallet.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: wallet.color + '20' }}
                        >
                          <Wallet
                            className="h-4 w-4"
                            style={{ color: wallet.color }}
                          />
                        </div>
                        <div>
                          <div className="font-medium">{wallet.name}</div>
                          {wallet.description && (
                            <div className="text-sm text-muted-foreground">
                              {wallet.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: typeInfo?.color,
                          color: typeInfo?.color,
                        }}
                      >
                        {typeInfo?.label || wallet.type}
                      </Badge>
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
                    <TableCell>${wallet.maxFillLimit.toFixed(2)}</TableCell>
                    <TableCell>${wallet.dailySpendingLimit.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">
                      ${wallet.currentBalance?.toFixed(2) || '0.00'}
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
              {editingWallet ? 'Edit Custom Wallet' : 'Create Custom Wallet'}
            </DialogTitle>
            <DialogDescription>
              {editingWallet
                ? 'Update the custom wallet details below.'
                : 'Create a new custom wallet type for your billing system.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                    className={
                      formData.name &&
                      wallets.some(
                        (w) =>
                          w.name.toLowerCase() === formData.name.toLowerCase() &&
                          w.id !== editingWallet?.id
                      )
                        ? 'border-red-500'
                        : ''
                    }
                  />
                  {formData.name &&
                    wallets.some(
                      (w) =>
                        w.name.toLowerCase() === formData.name.toLowerCase() &&
                        w.id !== editingWallet?.id
                    ) && (
                      <p className="text-sm text-red-500">
                        A wallet with this name already exists
                      </p>
                    )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxFillLimit">Max Fill Limit *</Label>
                  <Input
                    id="maxFillLimit"
                    type="number"
                    step="0.01"
                    value={formData.maxFillLimit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxFillLimit: parseFloat(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailySpendingLimit">Daily Spending Limit *</Label>
                  <Input
                    id="dailySpendingLimit"
                    type="number"
                    step="0.01"
                    value={formData.dailySpendingLimit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dailySpendingLimit: parseFloat(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
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
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(value) =>
                      setFormData({ ...formData, color: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {colorOptions.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded"
                              style={{ backgroundColor: color.value }}
                            />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Select
                    value={formData.icon}
                    onValueChange={(value) =>
                      setFormData({ ...formData, icon: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value}>
                          {icon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingWallet ? 'Update' : 'Create'} Wallet
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
              This will delete the custom wallet "{deletingWallet?.name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingWallet(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
