import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, Archive, RotateCcw } from 'lucide-react'
import { radiusProfileApi, type RadiusProfile } from '@/api/radiusProfileApi'
import { formatApiError } from '@/utils/errorHandler'

export default function RadiusProfiles() {
  const { id } = useParams<{ id: string }>()
  const workspaceId = parseInt(id || '0')
  const queryClient = useQueryClient()
  const parentRef = useRef<HTMLDivElement>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Profile state
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<RadiusProfile | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [profileToRestore, setProfileToRestore] = useState<number | null>(null)
  const [showTrash, setShowTrash] = useState(false)
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    downrate: '',
    uprate: '',
    price: '',
    monthly: '',
    pool: '',
    type: '',
    expirationAmount: '',
    expirationUnit: '0',
    enabled: true,
    burstEnabled: false,
    limitExpiration: false,
  })

  // Profile queries
  const { data: profilesData, isLoading: isLoadingProfiles, error: profilesError } = useQuery({
    queryKey: ['radius-profiles', workspaceId, currentPage, pageSize, searchQuery, showTrash],
    queryFn: () => showTrash
      ? radiusProfileApi.getTrash(workspaceId, currentPage, pageSize)
      : radiusProfileApi.getAll(workspaceId, currentPage, pageSize, searchQuery),
    enabled: workspaceId > 0,
  })

  const profiles = profilesData?.data || []
  const pagination = profilesData?.pagination

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: profiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approximate row height in pixels
    overscan: 5, // Number of items to render outside visible area
  })

  // Debug logging
  useEffect(() => {
    console.log('RadiusProfiles - workspaceId:', workspaceId)
    console.log('RadiusProfiles - Query enabled:', workspaceId > 0)
  }, [workspaceId])

  useEffect(() => {
    if (profilesData) {
      console.log('RadiusProfiles - API Response:', profilesData)
    }
  }, [profilesData])

  useEffect(() => {
    if (profilesError) {
      console.error('RadiusProfiles - API Error:', profilesError)
    }
  }, [profilesError])

  // Profile mutations
  const createProfileMutation = useMutation({
    mutationFn: (data: any) => radiusProfileApi.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile created successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create profile')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusProfileApi.update(workspaceId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile updated successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update profile')
    },
  })

  const deleteProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.delete(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete profile')
    },
  })

  const restoreProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.restore(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success('Profile restored successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to restore profile')
    },
  })

  const syncProfilesMutation = useMutation({
    mutationFn: () => radiusProfileApi.sync(workspaceId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', workspaceId] })
      toast.success(
        `Synced ${response.totalProfiles} profiles (${response.newProfiles} created, ${response.updatedProfiles} updated)`
      )
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to sync profiles')
    },
  })

  // Profile handlers
  const handleOpenProfileDialog = (profile?: RadiusProfile) => {
    if (profile) {
      setEditingProfile(profile)
      setProfileFormData({
        name: profile.name,
        downrate: profile.downrate?.toString() || '',
        uprate: profile.uprate?.toString() || '',
        price: profile.price?.toString() || '',
        monthly: profile.monthly?.toString() || '',
        pool: profile.pool || '',
        type: profile.type?.toString() || '',
        expirationAmount: profile.expirationAmount?.toString() || '',
        expirationUnit: profile.expirationUnit?.toString() || 'days',
        enabled: profile.enabled,
        burstEnabled: profile.burstEnabled,
        limitExpiration: profile.limitExpiration,
      })
    } else {
      setEditingProfile(null)
      setProfileFormData({
        name: '',
        downrate: '',
        uprate: '',
        price: '',
        monthly: '',
        pool: '',
        type: '',
        expirationAmount: '',
        expirationUnit: '0',
        enabled: true,
        burstEnabled: false,
        limitExpiration: false,
      })
    }
    setIsProfileDialogOpen(true)
  }

  const handleCloseProfileDialog = () => {
    setIsProfileDialogOpen(false)
    setEditingProfile(null)
  }

  const handleSaveProfile = () => {
    if (!profileFormData.name) {
      toast.error('Profile name is required')
      return
    }

    const data = {
      name: profileFormData.name,
      downrate: profileFormData.downrate ? parseInt(profileFormData.downrate) : 0,
      uprate: profileFormData.uprate ? parseInt(profileFormData.uprate) : 0,
      price: profileFormData.price ? parseFloat(profileFormData.price) : 0,
      monthly: profileFormData.monthly ? parseInt(profileFormData.monthly) : 0,
      pool: profileFormData.pool || undefined,
      type: profileFormData.type ? parseInt(profileFormData.type) : 0,
      expirationAmount: profileFormData.expirationAmount ? parseInt(profileFormData.expirationAmount) : 0,
      expirationUnit: profileFormData.expirationUnit ? parseInt(profileFormData.expirationUnit) : 0,
      enabled: profileFormData.enabled,
      burstEnabled: profileFormData.burstEnabled,
      limitExpiration: profileFormData.limitExpiration,
    }

    if (editingProfile && editingProfile.id) {
      updateProfileMutation.mutate({ id: editingProfile.id, data })
    } else {
      createProfileMutation.mutate(data)
    }
  }

  const handleDeleteProfile = (id?: number) => {
    if (id) {
      setProfileToDelete(id)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDeleteProfile = () => {
    if (profileToDelete) {
      deleteProfileMutation.mutate(profileToDelete)
      setDeleteDialogOpen(false)
      setProfileToDelete(null)
    }
  }

  const handleSyncProfiles = () => {
    syncProfilesMutation.mutate()
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value))
    setCurrentPage(1)
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Profiles</h1>
          <p className="text-muted-foreground">Manage RADIUS profiles for your workspace</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncProfiles} variant="outline" disabled={syncProfilesMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncProfilesMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Profiles
          </Button>
          <Button onClick={() => handleOpenProfileDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Profiles</CardTitle>
                <CardDescription>Manage RADIUS user profiles and their configurations</CardDescription>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Input
                  placeholder="Search profiles..."
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
                <span className="text-sm text-muted-foreground whitespace-nowrap">Per page:</span>
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
          {workspaceId <= 0 ? (
            <div className="text-center py-8 text-red-500">
              <p className="font-semibold mb-2">Invalid Workspace ID</p>
              <p className="text-sm">Please navigate to this page from the workspaces dashboard.</p>
              <p className="text-xs mt-2 text-muted-foreground">Current ID: {id || 'undefined'}</p>
            </div>
          ) : isLoadingProfiles ? (
            <div className="text-center py-8">Loading profiles...</div>
          ) : profilesError ? (
            <div className="text-center py-8 text-red-500">
              Error loading profiles: {profilesError instanceof Error ? profilesError.message : 'Unknown error'}
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-2">No profiles found.</p>
              <p className="text-sm">Click "Add Profile" to create one or "Sync Profiles" to fetch from SAS Radius server.</p>
              {pagination && (
                <p className="text-xs mt-4 text-muted-foreground">
                  Total records in database: {pagination.totalRecords}
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-hidden">
              {/* Fixed Header */}
              <div className="bg-muted border-b">
                <Table className="table-fixed w-full">
                  <colgroup>
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="hover:bg-muted">
                      <TableHead className="h-12 px-4 font-semibold">Name</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">Status</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">Download</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">Upload</TableHead>
                      <TableHead className="h-12 px-4 font-semibold text-right">Price</TableHead>
                      <TableHead className="h-12 px-4 font-semibold">Pool</TableHead>
                      <TableHead className="h-12 px-4 font-semibold text-right">Users</TableHead>
                      <TableHead className="h-12 px-4 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>

              {/* Scrollable Body */}
              <div ref={parentRef} className="overflow-y-auto overflow-x-hidden" style={{ height: 'calc(100vh - 452px)' }}>
                <Table className="table-fixed w-full">
                  <colgroup>
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const profile = profiles[virtualRow.index]
                      return (
                        <TableRow
                          key={profile.id}
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
                            <col style={{ width: '180px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '120px' }} />
                            <col style={{ width: '140px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '120px' }} />
                          </colgroup>
                          <TableCell className="h-12 px-4 font-medium">{profile.name}</TableCell>
                          <TableCell className="h-12 px-4">
                            <Badge variant={profile.enabled ? 'default' : 'secondary'}>
                              {profile.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell className="h-12 px-4">{profile.downrate ? `${formatNumber(profile.downrate)} Kbps` : '-'}</TableCell>
                          <TableCell className="h-12 px-4">{profile.uprate ? `${formatNumber(profile.uprate)} Kbps` : '-'}</TableCell>
                          <TableCell className="h-12 px-4 text-right font-mono">{profile.price ? `$${profile.price.toFixed(2)}` : '-'}</TableCell>
                          <TableCell className="h-12 px-4">{profile.pool || '-'}</TableCell>
                          <TableCell className="h-12 px-4 text-right">{formatNumber(profile.usersCount || 0)}</TableCell>
                          <TableCell className="h-12 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenProfileDialog(profile)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProfile(profile.id)}
                                disabled={deleteProfileMutation.isPending}
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
                Showing {formatNumber(profiles.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1)} to {formatNumber(((currentPage - 1) * pageSize) + profiles.length)} of {formatNumber(pagination.totalRecords)} profiles
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {pagination.totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Edit Profile' : 'Add Profile'}</DialogTitle>
            <DialogDescription>
              {editingProfile ? 'Update the profile details below.' : 'Fill in the details to create a new profile.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Name *</Label>
              <Input
                id="profile-name"
                value={profileFormData.name}
                onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                placeholder="Profile name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-downrate">Download Rate (Kbps)</Label>
                <Input
                  id="profile-downrate"
                  type="number"
                  value={profileFormData.downrate}
                  onChange={(e) => setProfileFormData({ ...profileFormData, downrate: e.target.value })}
                  placeholder="e.g., 10240"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-uprate">Upload Rate (Kbps)</Label>
                <Input
                  id="profile-uprate"
                  type="number"
                  value={profileFormData.uprate}
                  onChange={(e) => setProfileFormData({ ...profileFormData, uprate: e.target.value })}
                  placeholder="e.g., 5120"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-price">Price</Label>
                <Input
                  id="profile-price"
                  type="number"
                  step="0.01"
                  value={profileFormData.price}
                  onChange={(e) => setProfileFormData({ ...profileFormData, price: e.target.value })}
                  placeholder="e.g., 29.99"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-monthly">Monthly Price</Label>
                <Input
                  id="profile-monthly"
                  type="number"
                  step="0.01"
                  value={profileFormData.monthly}
                  onChange={(e) => setProfileFormData({ ...profileFormData, monthly: e.target.value })}
                  placeholder="e.g., 49.99"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-pool">Pool</Label>
                <Input
                  id="profile-pool"
                  value={profileFormData.pool}
                  onChange={(e) => setProfileFormData({ ...profileFormData, pool: e.target.value })}
                  placeholder="e.g., pool1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-type">Type</Label>
                <Input
                  id="profile-type"
                  value={profileFormData.type}
                  onChange={(e) => setProfileFormData({ ...profileFormData, type: e.target.value })}
                  placeholder="e.g., standard"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profile-expiration-amount">Expiration Amount</Label>
                <Input
                  id="profile-expiration-amount"
                  type="number"
                  value={profileFormData.expirationAmount}
                  onChange={(e) => setProfileFormData({ ...profileFormData, expirationAmount: e.target.value })}
                  placeholder="e.g., 30"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="profile-expiration-unit">Expiration Unit</Label>
                <Select
                  value={profileFormData.expirationUnit}
                  onValueChange={(value) => setProfileFormData({ ...profileFormData, expirationUnit: value })}
                >
                  <SelectTrigger id="profile-expiration-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Days</SelectItem>
                    <SelectItem value="1">Months</SelectItem>
                    <SelectItem value="2">Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-enabled">Enabled</Label>
                <Switch
                  id="profile-enabled"
                  checked={profileFormData.enabled}
                  onCheckedChange={(checked) => setProfileFormData({ ...profileFormData, enabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-burst-enabled">Burst Enabled</Label>
                <Switch
                  id="profile-burst-enabled"
                  checked={profileFormData.burstEnabled}
                  onCheckedChange={(checked) => setProfileFormData({ ...profileFormData, burstEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-limit-expiration">Limit Expiration</Label>
                <Switch
                  id="profile-limit-expiration"
                  checked={profileFormData.limitExpiration}
                  onCheckedChange={(checked) => setProfileFormData({ ...profileFormData, limitExpiration: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseProfileDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={!profileFormData.name || createProfileMutation.isPending || updateProfileMutation.isPending}
            >
              {editingProfile ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

