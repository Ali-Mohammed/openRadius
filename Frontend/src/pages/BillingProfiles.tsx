import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArchiveRestore, Search, Wallet, Package, DollarSign, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  restoreProfile,
  type BillingProfile,
  type CreateBillingProfileRequest,
  type BillingProfileWallet,
  type BillingProfileAddon,
} from '../api/billingProfiles';
import { radiusProfileApi } from '../api/radiusProfileApi';
import { getGroups } from '../api/groups';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const walletIconOptions = [
  { value: 'Wallet', label: 'Wallet', Icon: Wallet },
  { value: 'DollarSign', label: 'Dollar Sign', Icon: DollarSign },
  { value: 'Package', label: 'Package', Icon: Package },
];

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#06b6d4', label: 'Cyan' },
];

export default function BillingProfiles() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = parseInt(id || '0');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BillingProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  const [formData, setFormData] = useState<CreateBillingProfileRequest>({
    name: '',
    description: '',
    radiusProfileId: 0,
    billingGroupId: 0,
    wallets: [],
    addons: [],
  });

  const [wallets, setWallets] = useState<BillingProfileWallet[]>([]);
  const [addons, setAddons] = useState<BillingProfileAddon[]>([]);

  // Queries
  const { data: activeProfilesData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['billing-profiles', 'active', search],
    queryFn: () => getProfiles({ search, includeDeleted: false }),
  });

  const { data: deletedProfilesData, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ['billing-profiles', 'deleted', search],
    queryFn: () => getProfiles({ search, includeDeleted: true }),
  });

  const { data: radiusProfilesData, isLoading: isLoadingRadiusProfiles } = useQuery({
    queryKey: ['radius-profiles', workspaceId],
    queryFn: async () => {
      if (!workspaceId || workspaceId === 0) {
        console.log('No workspace ID available');
        return { data: [], pagination: { currentPage: 1, pageSize: 50, totalRecords: 0, totalPages: 0 } };
      }
      console.log('Fetching radius profiles for workspace:', workspaceId);
      const result = await radiusProfileApi.getAll(workspaceId, 1, 1000);
      console.log('Radius profiles result:', result);
      return result;
    },
    enabled: workspaceId > 0,
  });

  const { data: billingGroupsData, isLoading: isLoadingBillingGroups } = useQuery({
    queryKey: ['billing-groups'],
    queryFn: async () => {
      console.log('Fetching billing groups');
      const result = await getGroups({ includeDeleted: false });
      console.log('Billing groups result:', result);
      return result;
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to create billing profile';
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBillingProfileRequest }) =>
      updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update billing profile';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete billing profile');
      setDeleteConfirmId(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-profiles'] });
      toast.success('Billing profile restored successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to restore billing profile');
    },
  });

  const handleOpenDialog = (profile?: BillingProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setFormData({
        name: profile.name,
        description: profile.description || '',
        radiusProfileId: profile.radiusProfileId,
        billingGroupId: profile.billingGroupId,
        wallets: profile.wallets || [],
        addons: profile.addons || [],
      });
      setWallets(profile.wallets || []);
      setAddons(profile.addons || []);
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        description: '',
        radiusProfileId: 0,
        billingGroupId: 0,
        wallets: [],
        addons: [],
      });
      setWallets([]);
      setAddons([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setFormData({
      name: '',
      description: '',
      radiusProfileId: 0,
      billingGroupId: 0,
      wallets: [],
      addons: [],
    });
    setWallets([]);
    setAddons([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.radiusProfileId) {
      toast.error('Please select a radius profile');
      return;
    }
    if (!formData.billingGroupId) {
      toast.error('Please select a billing group');
      return;
    }
    if (wallets.length > 0) {
      const totalPercentage = wallets.reduce((sum, w) => sum + w.percentage, 0);
      if (totalPercentage !== 100) {
        toast.error(`Wallet percentages must sum to 100% (currently ${totalPercentage}%)`);
        return;
      }
    }

    const data = { ...formData, wallets, addons };

    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId !== null) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate(id);
  };

  const addWallet = () => {
    setWallets([
      ...wallets,
      {
        walletType: 'user',
        percentage: 0,
        icon: 'Wallet',
        color: '#3b82f6',
      },
    ]);
  };

  const removeWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const updateWallet = (index: number, field: keyof BillingProfileWallet, value: any) => {
    const updated = [...wallets];
    updated[index] = { ...updated[index], [field]: value };
    setWallets(updated);
  };

  const addAddon = () => {
    setAddons([
      ...addons,
      {
        title: '',
        description: '',
        price: 0,
      },
    ]);
  };

  const removeAddon = (index: number) => {
    setAddons(addons.filter((_, i) => i !== index));
  };

  const updateAddon = (index: number, field: keyof BillingProfileAddon, value: any) => {
    const updated = [...addons];
    updated[index] = { ...updated[index], [field]: value };
    setAddons(updated);
  };

  const totalPercentage = wallets.reduce((sum, w) => sum + w.percentage, 0);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Profiles</h1>
          <p className="text-muted-foreground mt-1">
            Configure billing profiles with radius profiles, billing groups, wallets, and addons
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Profile
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Profiles</TabsTrigger>
          <TabsTrigger value="deleted">Deleted Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>Addons</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingActive ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activeProfilesData?.data?.filter((p) => !p.isDeleted).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No profiles found
                    </TableCell>
                  </TableRow>
                ) : (
                  activeProfilesData?.data
                    ?.filter((p) => !p.isDeleted)
                    .map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {profile.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.wallets?.length || 0} wallets</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.addons?.length || 0} addons</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(profile)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(profile.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDeleted ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : deletedProfilesData?.data?.filter((p) => p.isDeleted).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No deleted profiles found
                    </TableCell>
                  </TableRow>
                ) : (
                  deletedProfilesData?.data
                    ?.filter((p) => p.isDeleted)
                    .map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium opacity-60">{profile.name}</TableCell>
                        <TableCell className="max-w-md truncate opacity-60">
                          {profile.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.wallets?.length || 0} wallets</Badge>
                        </TableCell>
                        <TableCell className="opacity-60">
                          {profile.deletedAt
                            ? new Date(profile.deletedAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(profile.id)}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the billing profile to trash. You can restore it later from the
              Deleted Profiles tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Edit Billing Profile' : 'Create Billing Profile'}
            </DialogTitle>
            <DialogDescription>
              Configure billing profile with radius profile, billing group, wallets, and addons
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            {/* Radius Profile & Billing Group */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="radiusProfile">Radius Profile *</Label>
                <Select
                  value={formData.radiusProfileId?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, radiusProfileId: parseInt(value) })
                  }
                  disabled={isLoadingRadiusProfiles}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingRadiusProfiles ? "Loading..." : "Select radius profile"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingRadiusProfiles ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading radius profiles...
                      </div>
                    ) : !radiusProfilesData?.data || radiusProfilesData.data.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No radius profiles available
                      </div>
                    ) : (
                      radiusProfilesData.data.map((profile: any) => (
                        <SelectItem key={profile.id} value={profile.id.toString()}>
                          {profile.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingGroup">Billing Group *</Label>
                <Select
                  value={formData.billingGroupId?.toString() || ''}
                  onValueChange={(value) =>
                    setFormData({ ...formData, billingGroupId: parseInt(value) })
                  }
                  disabled={isLoadingBillingGroups}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingBillingGroups ? "Loading..." : "Select billing group"} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingBillingGroups ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Loading billing groups...
                      </div>
                    ) : !billingGroupsData?.data || billingGroupsData.data.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No billing groups available
                      </div>
                    ) : (
                      billingGroupsData.data.map((group: any) => (
                        <SelectItem key={group.id} value={group.id.toString()}>
                          {group.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Wallets Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Wallets Configuration</CardTitle>
                    <CardDescription>
                      Add wallets with percentage distribution (must sum to 100%)
                      {wallets.length > 0 && (
                        <span
                          className={`ml-2 font-semibold ${
                            totalPercentage === 100
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          Total: {totalPercentage}%
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addWallet}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Wallet
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {wallets.map((wallet, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-5 gap-3 items-end">
                        <div className="space-y-2">
                          <Label>Wallet Type</Label>
                          <Select
                            value={wallet.walletType}
                            onValueChange={(value) => updateWallet(index, 'walletType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User Wallet</SelectItem>
                              <SelectItem value="custom">Custom Wallet</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Percentage</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={wallet.percentage}
                            onChange={(e) =>
                              updateWallet(index, 'percentage', parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Icon</Label>
                          <Select
                            value={wallet.icon}
                            onValueChange={(value) => updateWallet(index, 'icon', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {walletIconOptions.map((icon) => (
                                <SelectItem key={icon.value} value={icon.value}>
                                  {icon.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Color</Label>
                          <Select
                            value={wallet.color}
                            onValueChange={(value) => updateWallet(index, 'color', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {colorOptions.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-4 h-4 rounded-full border"
                                      style={{ backgroundColor: color.value }}
                                    />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWallet(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {wallets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No wallets added yet. Click "Add Wallet" to add a wallet configuration.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Addons Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Addons</CardTitle>
                    <CardDescription>Add optional addons with pricing</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAddon}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Addon
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {addons.map((addon, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-4 gap-3 items-end">
                        <div className="space-y-2">
                          <Label>Title</Label>
                          <Input
                            value={addon.title}
                            onChange={(e) => updateAddon(index, 'title', e.target.value)}
                            placeholder="Addon title"
                          />
                        </div>
                        <div className="space-y-2 col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={addon.description}
                            onChange={(e) => updateAddon(index, 'description', e.target.value)}
                            placeholder="Addon description"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={addon.price}
                              onChange={(e) =>
                                updateAddon(index, 'price', parseFloat(e.target.value) || 0)
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAddon(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {addons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No addons added yet. Click "Add Addon" to add an optional addon.
                  </p>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingProfile ? 'Update Profile' : 'Create Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
