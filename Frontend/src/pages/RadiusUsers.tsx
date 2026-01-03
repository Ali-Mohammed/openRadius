import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { radiusUserApi, type RadiusUser } from '@/api/radiusUserApi'
import { radiusProfileApi } from '@/api/radiusProfileApi'
import { formatApiError } from '@/utils/errorHandler'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Hardcoded workspaceId for now - will be dynamic based on routing later
const WORKSPACE_ID = 1

export default function RadiusUsers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // User state
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<RadiusUser | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    city: '',
    profileId: '',
    balance: '',
    expiration: '',
    enabled: true,
    staticIp: '',
    company: '',
    address: '',
    contractId: '',
    simultaneousSessions: '1',
  })

  // Queries
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['radius-users', WORKSPACE_ID, currentPage, pageSize, searchQuery],
    queryFn: () => radiusUserApi.getAll(WORKSPACE_ID, currentPage, pageSize, searchQuery),
  })

  const { data: profilesData } = useQuery({
    queryKey: ['radius-profiles', WORKSPACE_ID],
    queryFn: () => radiusProfileApi.getAll(WORKSPACE_ID, 1, 999999),
  })

  const users = usersData?.data || []
  const pagination = usersData?.pagination
  const profiles = profilesData?.data || []

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: users.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approximate row height in pixels
    overscan: 5, // Number of items to render outside visible area
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => radiusUserApi.create(WORKSPACE_ID, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', WORKSPACE_ID] })
      toast.success('User created successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusUserApi.update(WORKSPACE_ID, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', WORKSPACE_ID] })
      toast.success('User updated successfully')
      handleCloseDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => radiusUserApi.delete(WORKSPACE_ID, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', WORKSPACE_ID] })
      toast.success('User deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete user')
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => radiusUserApi.sync(WORKSPACE_ID),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', WORKSPACE_ID] })
      toast.success(
        `Synced ${response.totalUsers} users (${response.newUsers} created, ${response.updatedUsers} updated)`
      )
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to sync users')
    },
  })

  // Handlers
  const handleOpenDialog = (user?: RadiusUser) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        username: user.username,
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        city: user.city || '',
        profileId: user.profileId?.toString() || '',
        balance: user.balance?.toString() || '0',
        expiration: user.expiration ? user.expiration.substring(0, 10) : '',
        enabled: user.enabled,
        staticIp: user.staticIp || '',
        company: user.company || '',
        address: user.address || '',
        contractId: user.contractId || '',
        simultaneousSessions: user.simultaneousSessions?.toString() || '1',
      })
    } else {
      setEditingUser(null)
      setFormData({
        username: '',
        firstname: '',
        lastname: '',
        email: '',
        phone: '',
        city: '',
        profileId: '',
        balance: '0',
        expiration: '',
        enabled: true,
        staticIp: '',
        company: '',
        address: '',
        contractId: '',
        simultaneousSessions: '1',
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
  }

  const handleSave = () => {
    if (!formData.username) {
      toast.error('Username is required')
      return
    }

    const data = {
      username: formData.username,
      firstname: formData.firstname || undefined,
      lastname: formData.lastname || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      city: formData.city || undefined,
      profileId: formData.profileId ? parseInt(formData.profileId) : undefined,
      balance: parseFloat(formData.balance) || 0,
      expiration: formData.expiration ? new Date(formData.expiration).toISOString() : undefined,
      enabled: formData.enabled,
      staticIp: formData.staticIp || undefined,
      company: formData.company || undefined,
      address: formData.address || undefined,
      contractId: formData.contractId || undefined,
      simultaneousSessions: parseInt(formData.simultaneousSessions) || 1,
    }

    if (editingUser && editingUser.id) {
      updateMutation.mutate({ id: editingUser.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleDelete = (id?: number) => {
    if (id && confirm('Are you sure you want to delete this user?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleSync = () => {
    syncMutation.mutate()
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1) // Reset to first page on new search
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1) // Reset to first page
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('radiusUsers.title')}</h1>
          <p className="text-muted-foreground">{t('radiusUsers.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} variant="outline" disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            {t('radiusUsers.syncUsers')}
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            {t('radiusUsers.addUser')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('radiusUsers.users')}</CardTitle>
                <CardDescription>{t('radiusUsers.viewManage')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder={t('radiusUsers.searchUsers')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="max-w-sm"
                />
                <Button onClick={handleSearch} variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">{t('radiusUsers.perPage')}</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="999999">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="text-center py-8">{t('common.loading')}</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('radiusUsers.noUsersFound')}
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Fixed Header */}
              <div className="bg-muted border-b">
                <Table className="table-fixed w-full">
                  <colgroup>
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-muted">
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.username')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.name')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.email')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.phone')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.profile')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.status')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold text-right">{t('radiusUsers.balance')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">{t('radiusUsers.expiration')}</TableHead>
                      <TableHead className="h-12 px-4 font-semibold text-right">{t('radiusUsers.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
              
              {/* Scrollable Body */}
              <div ref={parentRef} className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100vh - 452px)' }}>
                <Table className="table-fixed w-full">
                  <colgroup>
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const user = users[virtualRow.index]
                        return (
                          <TableRow 
                            key={user.id}
                            className="border-b"
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            display: 'table',
                            tableLayout: 'fixed',
                          }}
                        >
                          <colgroup>
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '180px' }} />
                            <col style={{ width: '200px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '120px' }} />
                          </colgroup>
                          <TableCell className="h-12 px-4 font-medium">{user.username}</TableCell>
                          <TableCell className="h-12 px-4">
                            {user.firstname || user.lastname
                              ? `${user.firstname || ''} ${user.lastname || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell className="h-12 px-4 max-w-[200px] truncate" title={user.email || '-'}>
                            {user.email || '-'}
                          </TableCell>
                          <TableCell className="h-12 px-4">{user.phone || '-'}</TableCell>
                          <TableCell className="h-12 px-4">{user.profileName || '-'}</TableCell>
                          <TableCell className="h-12 px-4">
                            <Badge variant={user.enabled ? 'default' : 'secondary'}>
                              {user.enabled ? t('radiusUsers.enabled') : t('radiusUsers.disabled')}
                            </Badge>
                          </TableCell>
                          <TableCell className="h-12 px-4 text-right font-mono">${user.balance?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell className="h-12 px-4">{formatDate(user.expiration)}</TableCell>
                          <TableCell className="h-12 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(user.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          
          {/* Pagination Controls - Always visible */}
          {pagination && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
              <div className="text-sm text-muted-foreground">
                {t('radiusUsers.showing')} {formatNumber(users.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} {t('radiusUsers.to')} {formatNumber(((currentPage - 1) * pageSize) + users.length)} {t('radiusUsers.of')} {formatNumber(pagination.totalRecords)} {t('radiusUsers.users')}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common.previous')}
                </Button>
                <div className="text-sm">
                  {t('common.page')} {currentPage} {t('radiusUsers.of')} {pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? t('radiusUsers.editUser') : t('radiusUsers.addUser')}</DialogTitle>
            <DialogDescription>
              {editingUser ? t('radiusUsers.updateDetails') : t('radiusUsers.fillDetails')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">{t('radiusUsers.username')} *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., john.doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t('radiusUsers.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">{t('radiusUsers.firstName')}</Label>
                <Input
                  id="firstname"
                  value={formData.firstname}
                  onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                  placeholder="e.g., John"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">{t('radiusUsers.lastName')}</Label>
                <Input
                  id="lastname"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  placeholder="e.g., Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('radiusUsers.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +1234567890"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">{t('radiusUsers.city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., New York"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profileId">{t('radiusUsers.profileId')}</Label>
                <Select
                  value={formData.profileId}
                  onValueChange={(value) => setFormData({ ...formData, profileId: value })}
                >
                  <SelectTrigger id="profileId">
                    <SelectValue placeholder={t('radiusUsers.selectProfile')} />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id?.toString() || ''}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="balance">{t('radiusUsers.balance')}</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="e.g., 100.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="simultaneousSessions">{t('radiusUsers.sessions')}</Label>
                <Input
                  id="simultaneousSessions"
                  type="number"
                  value={formData.simultaneousSessions}
                  onChange={(e) => setFormData({ ...formData, simultaneousSessions: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiration">{t('radiusUsers.expirationDate')}</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={formData.expiration}
                  onChange={(e) => setFormData({ ...formData, expiration: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staticIp">{t('radiusUsers.staticIp')}</Label>
                <Input
                  id="staticIp"
                  value={formData.staticIp}
                  onChange={(e) => setFormData({ ...formData, staticIp: e.target.value })}
                  placeholder="e.g., 192.168.1.100"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company">{t('radiusUsers.company')}</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="e.g., Acme Corp"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">{t('radiusUsers.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="e.g., 123 Main St"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contractId">{t('radiusUsers.contractId')}</Label>
              <Input
                id="contractId"
                value={formData.contractId}
                onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                placeholder="e.g., CONTRACT-2024-001"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">{t('radiusUsers.enabled')}</Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('radiusUsers.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.username || createMutation.isPending || updateMutation.isPending}
            >
              {editingUser ? t('radiusUsers.update') : t('radiusUsers.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

