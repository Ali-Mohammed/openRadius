import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Archive, RotateCcw, Package, Gift, Star, Zap, Crown, Trophy, Heart, Sparkles, type LucideIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { addonApi, type Addon } from '@/api/addons'
import { customWalletApi } from '@/api/customWallets'
import { workspaceApi } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'

// Icon picker component
const AVAILABLE_ICONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'Package', label: 'Package', icon: Package },
  { value: 'Gift', label: 'Gift', icon: Gift },
  { value: 'Star', label: 'Star', icon: Star },
  { value: 'Zap', label: 'Zap', icon: Zap },
  { value: 'Crown', label: 'Crown', icon: Crown },
  { value: 'Trophy', label: 'Trophy', icon: Trophy },
  { value: 'Heart', label: 'Heart', icon: Heart },
  { value: 'Sparkles', label: 'Sparkles', icon: Sparkles },
]

// Helper to get icon component
const getIconComponent = (iconName?: string): LucideIcon => {
  const iconObj = AVAILABLE_ICONS.find(i => i.value === iconName)
  return iconObj?.icon || Package
}

const AVAILABLE_COLORS = [
  { value: 'blue', label: 'Blue', hex: '#3b82f6' },
  { value: 'green', label: 'Green', hex: '#10b981' },
  { value: 'purple', label: 'Purple', hex: '#8b5cf6' },
  { value: 'pink', label: 'Pink', hex: '#ec4899' },
  { value: 'yellow', label: 'Yellow', hex: '#f59e0b' },
  { value: 'red', label: 'Red', hex: '#ef4444' },
  { value: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { value: 'orange', label: 'Orange', hex: '#f97316' },
]

export default function Addons() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showTrash, setShowTrash] = useState(false)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addonToDelete, setAddonToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [addonToRestore, setAddonToRestore] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Package',
    color: 'blue',
    price: '',
    customWalletId: '',
    linkToWallet: false,
  })

  // Helper to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع' : 'IQD'
      case 'USD':
      default:
        return '$'
    }
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

  const { data: addonsData, isLoading } = useQuery({
    queryKey: ['addons', currentPage, pageSize, searchQuery, showTrash],
    queryFn: () => addonApi.getAll({
      search: searchQuery || undefined,
      page: currentPage,
      pageSize: pageSize,
      includeDeleted: showTrash,
    }),
  })

  const { data: walletsData } = useQuery({
    queryKey: ['custom-wallets'],
    queryFn: () => customWalletApi.getAll(),
  })

  const addons = addonsData?.data || []
  const pagination = addonsData
  const wallets = walletsData?.data || []

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Addon) => addonApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      toast.success('Addon created successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to create addon')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Addon }) => addonApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      toast.success('Addon updated successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update addon')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => addonApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      toast.success('Addon deleted successfully')
      setDeleteDialogOpen(false)
      setAddonToDelete(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete addon')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: number) => addonApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['addons'] })
      toast.success('Addon restored successfully')
      setRestoreDialogOpen(false)
      setAddonToRestore(null)
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to restore addon')
    },
  })

  // Handlers
  const handleOpenDialog = (addon?: Addon) => {
    if (addon) {
      setEditingAddon(addon)
      setFormData({
        name: addon.name,
        description: addon.description || '',
        icon: addon.icon || 'Package',
        color: addon.color || 'blue',
        price: addon.price.toString(),
        customWalletId: addon.customWalletId?.toString() || '',
        linkToWallet: !!addon.customWalletId,
      })
    } else {
      setEditingAddon(null)
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'Package',
      color: 'blue',
      price: '',
      customWalletId: '',
      linkToWallet: false,
    })
    setEditingAddon(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.price) {
      toast.error('Please fill in all required fields')
      return
    }

    if (formData.linkToWallet && !formData.customWalletId) {
      toast.error('Please select a wallet or uncheck the link option')
      return
    }

    const addonData: Addon = {
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      color: formData.color,
      price: parseFloat(formData.price),
      customWalletId: formData.linkToWallet && formData.customWalletId 
        ? parseInt(formData.customWalletId) 
        : undefined,
    }

    if (editingAddon) {
      updateMutation.mutate({ id: editingAddon.id!, data: { ...addonData, id: editingAddon.id } })
    } else {
      createMutation.mutate(addonData)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleDelete = (id: number) => {
    setAddonToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (addonToDelete) {
      deleteMutation.mutate(addonToDelete)
    }
  }

  const handleRestore = (id: number) => {
    setAddonToRestore(id)
    setRestoreDialogOpen(true)
  }

  const confirmRestore = () => {
    if (addonToRestore) {
      restoreMutation.mutate(addonToRestore)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Addons</h1>
          <p className="text-muted-foreground">
            Manage billing addons and attach them to profiles
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Addon
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search addons..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-8"
                />
              </div>
              <Button onClick={handleSearch} variant="secondary">
                Search
              </Button>
            </div>

            <Button
              variant={showTrash ? 'default' : 'outline'}
              onClick={() => {
                setShowTrash(!showTrash)
                setCurrentPage(1)
              }}
            >
              {showTrash ? (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Show Active
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Show Trash
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Icon</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Custom Wallet</TableHead>
                <TableHead>Status</TableHead>
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
              ) : addons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No addons found
                  </TableCell>
                </TableRow>
              ) : (
                addons.map((addon) => {
                  const colorObj = AVAILABLE_COLORS.find(c => c.value === addon.color)
                  const IconComponent = getIconComponent(addon.icon)
                  return (
                    <TableRow key={addon.id}>
                      <TableCell>
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                          style={{ backgroundColor: colorObj?.hex || '#3b82f6' }}
                        >
                          <IconComponent className="h-5 w-5" />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{addon.name}</TableCell>
                      <TableCell className="max-w-md truncate">{addon.description || '-'}</TableCell>
                      <TableCell className="font-medium">
                        {currencySymbol} {formatCurrency(addon.price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{addon.customWalletName}</Badge>
                      </TableCell>
                      <TableCell>
                        {addon.isDeleted ? (
                          <Badge variant="destructive">Deleted</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {addon.isDeleted ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestore(addon.id!)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(addon)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(addon.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalCount > 0 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalCount)} of {pagination.totalCount} addons
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">Rows per page</p>
                  <Select value={pageSize.toString()} onValueChange={(value) => {
                    setPageSize(parseInt(value))
                    setCurrentPage(1)
                  }}>
                    <SelectTrigger className="w-[70px]">
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

                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {pagination.totalPages}
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAddon ? 'Edit Addon' : 'Create Addon'}</DialogTitle>
            <DialogDescription>
              {editingAddon ? 'Update addon information' : 'Add a new addon to the system'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Premium Support"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Price ({currencySymbol}) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the addon..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="icon">Icon</Label>
                <Select value={formData.icon} onValueChange={(value) => setFormData({ ...formData, icon: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((iconOption) => {
                      const IconComp = iconOption.icon
                      return (
                        <SelectItem key={iconOption.value} value={iconOption.value}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {iconOption.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: color.hex }} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="linkToWallet"
                  checked={formData.linkToWallet}
                  onCheckedChange={(checked) => {
                    setFormData({ 
                      ...formData, 
                      linkToWallet: checked as boolean,
                      customWalletId: checked ? formData.customWalletId : ''
                    })
                  }}
                />
                <Label
                  htmlFor="linkToWallet"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Link to Custom Wallet (Optional)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Enable this to track addon revenue in a specific wallet
              </p>

              {formData.linkToWallet && (
                <div className="space-y-2">
                  <Label htmlFor="customWallet">Custom Wallet *</Label>
                  <Select value={formData.customWalletId} onValueChange={(value) => setFormData({ ...formData, customWalletId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a wallet" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id!.toString()}>
                          {wallet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAddon ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Addon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this addon? This action can be undone from the trash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Addon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore this addon?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>Restore</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
