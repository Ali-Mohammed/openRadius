import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { radiusProfileApi, type RadiusProfile } from '@/api/radiusProfileApi'
import { formatApiError } from '@/utils/errorHandler'

export default function RadiusProfiles() {
  const { id } = useParams<{ id: string }>()
  const instantId = parseInt(id || '0')
  const queryClient = useQueryClient()

  // Profile state
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<RadiusProfile | null>(null)
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
  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['radius-profiles', instantId],
    queryFn: () => radiusProfileApi.getAll(instantId),
    enabled: instantId > 0,
  })

  // Profile mutations
  const createProfileMutation = useMutation({
    mutationFn: (data: any) => radiusProfileApi.create(instantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', instantId] })
      toast.success('Profile created successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to create profile')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      radiusProfileApi.update(instantId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', instantId] })
      toast.success('Profile updated successfully')
      handleCloseProfileDialog()
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to update profile')
    },
  })

  const deleteProfileMutation = useMutation({
    mutationFn: (id: number) => radiusProfileApi.delete(instantId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', instantId] })
      toast.success('Profile deleted successfully')
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || 'Failed to delete profile')
    },
  })

  const syncProfilesMutation = useMutation({
    mutationFn: () => radiusProfileApi.sync(instantId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['radius-profiles', instantId] })
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
    if (id && confirm('Are you sure you want to delete this profile?')) {
      deleteProfileMutation.mutate(id)
    }
  }

  const handleSyncProfiles = () => {
    syncProfilesMutation.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Profiles</h1>
          <p className="text-muted-foreground">Manage RADIUS profiles for your instant</p>
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
          <CardTitle>Profiles</CardTitle>
          <CardDescription>Manage RADIUS user profiles and their configurations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingProfiles ? (
            <div className="text-center py-8">Loading profiles...</div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No profiles found. Click "Add Profile" to create one or "Sync Profiles" to fetch from SAS Radius server.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Download</TableHead>
                  <TableHead>Upload</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell>
                      <Badge variant={profile.enabled ? 'default' : 'secondary'}>
                        {profile.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell>{profile.downrate ? `${profile.downrate} Kbps` : '-'}</TableCell>
                    <TableCell>{profile.uprate ? `${profile.uprate} Kbps` : '-'}</TableCell>
                    <TableCell>{profile.price ? `$${profile.price.toFixed(2)}` : '-'}</TableCell>
                    <TableCell>{profile.pool || '-'}</TableCell>
                    <TableCell>{profile.usersCount || 0}</TableCell>
                    <TableCell className="text-right">
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
                ))}
              </TableBody>
            </Table>
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
    </div>
  )
}
