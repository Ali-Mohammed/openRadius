import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ArchiveRestore, Search, Wallet, Package, DollarSign, X, Check, Archive, RefreshCw, Receipt } from 'lucide-react';
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
import { addonApi, type Addon } from '../api/addons';
import { customWalletApi } from '../api/customWallets';
import userWalletApi from '../api/userWallets';
import { workspaceApi } from '../api/workspaceApi';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { i18n } from '../i18n';
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
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../components/ui/command';
import { cn } from '../lib/utils';

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
  const navigate = useNavigate();
  const workspaceId = parseInt(id || '0');
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<BillingProfile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');

  // Fetch workspace for currency
  const { data: workspace } = useQuery({
    queryKey: ['workspace', currentWorkspaceId],
    queryFn: () => workspaceApi.getById(currentWorkspaceId!),
    enabled: !!currentWorkspaceId,
  });

  // Helper function to get currency symbol
  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case 'IQD':
        return i18n.language === 'ar' ? 'د.ع ' : 'IQD ';
      case 'USD':
      default:
        return '$';
    }
  };

  const currencySymbol = getCurrencySymbol(workspace?.currency);

  const [formData, setFormData] = useState<CreateBillingProfileRequest>({
    name: '',
    description: '',
    price: 0,
    radiusProfileId: 0,
    billingGroupId: 0,
    wallets: [],
    addons: [],
  });

  const [selectedRadiusProfiles, setSelectedRadiusProfiles] = useState<{profileId: number, number: number}[]>([]);
  const [selectedBillingGroups, setSelectedBillingGroups] = useState<number[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{addonId: number, price: number, number: number}[]>([]);
  const [radiusProfilePopoverOpen, setRadiusProfilePopoverOpen] = useState(false);
  const [billingGroupPopoverOpen, setBillingGroupPopoverOpen] = useState(false);
  const [addonPopoverOpen, setAddonPopoverOpen] = useState(false);
  const [selectAllGroups, setSelectAllGroups] = useState(false);

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
    queryKey: ['radius-profiles'],
    queryFn: async () => {
      if (!workspaceId || workspaceId === 0) {
        console.log('No workspace ID available');
        return { data: [], pagination: { currentPage: 1, pageSize: 50, totalRecords: 0, totalPages: 0 } };
      }
      console.log('Fetching radius profiles for workspace:', workspaceId);
      const result = await radiusProfileApi.getAll(1, 1000);
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

  const { data: addonsData, isLoading: isLoadingAddons } = useQuery({
    queryKey: ['addons'],
    queryFn: () => addonApi.getAll({ includeDeleted: false }),
  });

  const { data: userWalletsData, isLoading: isLoadingUserWallets } = useQuery({
    queryKey: ['user-wallets'],
    queryFn: () => userWalletApi.getAll({ status: 'active' }),
  });

  const { data: customWalletsData, isLoading: isLoadingCustomWallets } = useQuery({
    queryKey: ['custom-wallets'],
    queryFn: () => customWalletApi.getAll({ status: 'active', pageSize: 1000 }),
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
        price: profile.price || 0,
        radiusProfileId: profile.radiusProfileId,
        billingGroupId: profile.billingGroupId,
        wallets: profile.wallets || [],
        addons: profile.addons || [],
      });
      setWallets(profile.wallets || []);
      setSelectedRadiusProfiles([{profileId: profile.radiusProfileId, number: 1}]);
      
      // Check if "All Groups" is selected (billingGroupId === 0 or null)
      const isAllGroups = profile.billingGroupId === 0 || profile.billingGroupId === null;
      setSelectAllGroups(isAllGroups);
      setSelectedBillingGroups(isAllGroups ? [] : [profile.billingGroupId]);
      
      setSelectedAddons(
        profile.addons?.map(a => ({ addonId: a.id!, price: a.price, number: 1 })) || []
      );
    } else {
      setEditingProfile(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        radiusProfileId: 0,
        billingGroupId: 0,
        wallets: [],
        addons: [],
      });
      setWallets([]);
      setSelectedRadiusProfiles([]);
      setSelectedBillingGroups([]);
      setSelectAllGroups(false);
      setSelectedAddons([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProfile(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      radiusProfileId: 0,
      billingGroupId: 0,
      wallets: [],
      addons: [],
    });
    setWallets([]);
    setSelectedRadiusProfiles([]);
    setSelectedBillingGroups([]);
    setSelectAllGroups(false);
    setSelectedAddons([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (selectedRadiusProfiles.length === 0) {
      toast.error('Please select at least one radius profile');
      return;
    }

    // Validate all radius profiles have a number > 0
    const invalidProfile = selectedRadiusProfiles.find(rp => !rp.number || rp.number <= 0);
    if (invalidProfile) {
      toast.error('All radius profiles must have a number greater than 0');
      return;
    }
    if (!selectAllGroups && selectedBillingGroups.length === 0) {
      toast.error('Please select at least one billing group or "All Groups"');
      return;
    }

    // Validate all addons have a number > 0
    const invalidAddon = selectedAddons.find(addon => !addon.number || addon.number <= 0);
    if (invalidAddon) {
      toast.error('All addons must have a number greater than 0');
      return;
    }

    // Convert selectedAddons to BillingProfileAddon format
    const profileAddons = selectedAddons.map((sa, index) => {
      const addon = addonsData?.data?.find((a: Addon) => a.id === sa.addonId);
      return {
        title: addon?.name || '',
        description: addon?.description || '',
        price: sa.price,
        displayOrder: index,
      };
    });

    // For now, use the first selected radius profile and billing group as the main one
    // TODO: Backend might need to be updated to support multiple
    const data = { 
      ...formData, 
      radiusProfileId: selectedRadiusProfiles[0].profileId,
      billingGroupId: selectAllGroups ? 0 : selectedBillingGroups[0], // 0 means all groups
      wallets, 
      addons: profileAddons 
    };

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
        userWalletId: undefined,
        customWalletId: undefined,
        percentage: 0,
        icon: '',
        color: '',
        direction: 'in',
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Profiles</h1>
          <p className="text-sm text-muted-foreground">Configure billing profiles with radius profiles, billing groups, wallets, and addons</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">
                <Receipt className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search profiles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => setSearch(search)} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['billing-profiles'] })} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => navigate('/billing/profiles/new')} disabled={activeTab === 'deleted'}>
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {activeTab === 'active' ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Radius Profile</TableHead>
                  <TableHead>Billing Group</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>Addons</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingActive ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activeProfilesData?.data?.filter((p) => !p.isDeleted).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No profiles found
                    </TableCell>
                  </TableRow>
                ) : (
                  activeProfilesData?.data
                    ?.filter((p) => !p.isDeleted)
                    .map((profile) => {
                      const radiusProfile = radiusProfilesData?.data?.find((rp: any) => rp.id === profile.radiusProfileId);
                      const billingGroup = billingGroupsData?.data?.find((bg: any) => bg.id === profile.billingGroupId);
                      
                      return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell className="max-w-md truncate">
                          {profile.description || '-'}
                        </TableCell>
                        <TableCell>
                          {profile.price ? (
                            <span className="font-medium">{currencySymbol}{profile.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {radiusProfile ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{radiusProfile.name}</span>
                              {radiusProfile.downrate && radiusProfile.uprate && (
                                <span className="text-xs text-muted-foreground">
                                  {radiusProfile.downrate}/{radiusProfile.uprate} Mbps
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {profile.billingGroupId === 0 || !billingGroup ? (
                            <Badge variant="outline">All Groups</Badge>
                          ) : (
                            <Badge variant="secondary">{billingGroup.name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.wallets?.length || 0} wallets</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.addons?.length || 0} addons</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(profile.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/billing/profiles/edit?profileId=${profile.id}`)}
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
                    );
                    })
                )}
              </TableBody>
            </Table>
          </div>
          ) : (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Radius Profile</TableHead>
                  <TableHead>Billing Group</TableHead>
                  <TableHead>Wallets</TableHead>
                  <TableHead>Addons</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead>Deleted By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDeleted ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : deletedProfilesData?.data?.filter((p) => p.isDeleted).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center">
                      No deleted profiles found
                    </TableCell>
                  </TableRow>
                ) : (
                  deletedProfilesData?.data
                    ?.filter((p) => p.isDeleted)
                    .map((profile) => {
                      const radiusProfile = radiusProfilesData?.data?.find((rp: any) => rp.id === profile.radiusProfileId);
                      const billingGroup = billingGroupsData?.data?.find((bg: any) => bg.id === profile.billingGroupId);
                      
                      return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium opacity-60">{profile.name}</TableCell>
                        <TableCell className="max-w-md truncate opacity-60">
                          {profile.description || '-'}
                        </TableCell>
                        <TableCell className="opacity-60">
                          {profile.price ? (
                            <span className="font-medium">{currencySymbol}{profile.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="opacity-60">
                          {radiusProfile ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{radiusProfile.name}</span>
                              {radiusProfile.downrate && radiusProfile.uprate && (
                                <span className="text-xs text-muted-foreground">
                                  {radiusProfile.downrate}/{radiusProfile.uprate} Mbps
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="opacity-60">
                          {profile.billingGroupId === 0 || !billingGroup ? (
                            <Badge variant="outline">All Groups</Badge>
                          ) : (
                            <Badge variant="secondary">{billingGroup.name}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.wallets?.length || 0} wallets</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.addons?.length || 0} addons</Badge>
                        </TableCell>
                        <TableCell className="opacity-60">
                          {profile.deletedAt
                            ? new Date(profile.deletedAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell className="opacity-60">
                          {profile.deletedBy || '-'}
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
                    );
                    })
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </CardContent>
      </Card>

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
            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Billing Groups Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Billing Groups *</CardTitle>
                    <CardDescription>
                      Select billing groups or choose "All Groups"
                    </CardDescription>
                  </div>
                  <Popover open={billingGroupPopoverOpen} onOpenChange={setBillingGroupPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingBillingGroups || selectAllGroups}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Group
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search billing groups..." />
                        <CommandEmpty>No billing group found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          <CommandItem
                            value="all-groups"
                            onSelect={() => {
                              setSelectAllGroups(true);
                              setSelectedBillingGroups([]);
                              setBillingGroupPopoverOpen(false);
                            }}
                          >
                            <strong>All Groups</strong>
                          </CommandItem>
                          {billingGroupsData?.data?.map((group: any) => (
                            <CommandItem
                              key={group.id}
                              value={group.name}
                              onSelect={() => {
                                if (!selectedBillingGroups.includes(group.id)) {
                                  setSelectedBillingGroups(prev => [...prev, group.id]);
                                  setSelectAllGroups(false);
                                }
                                setBillingGroupPopoverOpen(false);
                              }}
                            >
                              {group.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectAllGroups ? (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">All Groups</div>
                          <div className="text-sm text-muted-foreground">
                            This profile applies to all billing groups
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectAllGroups(false)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {selectedBillingGroups.map((groupId) => {
                      const group = billingGroupsData?.data?.find((g: any) => g.id === groupId);
                      return group ? (
                        <Card key={groupId}>
                          <CardContent className="pt-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium">{group.name}</div>
                                {group.description && (
                                  <div className="text-sm text-muted-foreground">{group.description}</div>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBillingGroups(prev => prev.filter(id => id !== groupId))}
                              >
                              <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ) : null;
                    })}
                    {selectedBillingGroups.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No billing groups selected. Click "Add Group" to select a billing group or choose "All Groups".
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Radius Profiles Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Radius Profiles *</CardTitle>
                    <CardDescription>
                      Select radius profiles to associate with this billing profile
                    </CardDescription>
                  </div>
                  <Popover open={radiusProfilePopoverOpen} onOpenChange={setRadiusProfilePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingRadiusProfiles}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Profile
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search radius profiles..." />
                        <CommandEmpty>No radius profile found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {radiusProfilesData?.data?.map((profile: any) => (
                            <CommandItem
                              key={profile.id}
                              value={profile.name}
                              onSelect={() => {
                                if (!selectedRadiusProfiles.find(rp => rp.profileId === profile.id)) {
                                  setSelectedRadiusProfiles(prev => [...prev, {profileId: profile.id, number: 1}]);
                                }
                                setRadiusProfilePopoverOpen(false);
                              }}
                            >
                              {profile.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedRadiusProfiles.map((rp, index) => {
                  const profile = radiusProfilesData?.data?.find((p: any) => p.id === rp.profileId);
                  return profile ? (
                    <Card key={rp.profileId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="font-medium">{profile.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {profile.downrate && profile.uprate && (
                                <>Download: {profile.downrate}Mbps / Upload: {profile.uprate}Mbps</>
                              )}
                              {profile.price && <> • Price: ${profile.price}</>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <Label className="text-xs mb-1">Number</Label>
                              <Input
                                type="number"
                                min="1"
                                value={rp.number}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  setSelectedRadiusProfiles(prev => 
                                    prev.map(item => 
                                      item.profileId === rp.profileId 
                                        ? {...item, number: value}
                                        : item
                                    )
                                  );
                                }}
                                className="w-20"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedRadiusProfiles(prev => prev.filter(item => item.profileId !== rp.profileId))}
                              className="mt-5"
                            >
                             <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null;
                })}
                {selectedRadiusProfiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No radius profiles added yet. Click "Add Profile" to select a radius profile.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Wallets Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Wallets Configuration</CardTitle>
                    <CardDescription>
                      Add wallets with pricing for each wallet type
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
                      <div className="grid grid-cols-[180px_2fr_150px_140px_auto] gap-3">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select
                            value={wallet.walletType || 'user'}
                            onValueChange={(value) => {
                              const updated = [...wallets];
                              updated[index] = { 
                                ...updated[index], 
                                walletType: value,
                                userWalletId: undefined,
                                customWalletId: undefined
                              };
                              setWallets(updated);
                            }}
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
                        
                        {/* Wallet Selection - conditionally render based on type */}
                        <div className="space-y-2">
                          {wallet.walletType === 'user' ? (
                            <>
                              <Label>User Wallet</Label>
                              <Select
                                key={`user-${index}`}
                                value={wallet.userWalletId?.toString() || ''}
                                onValueChange={(value) => updateWallet(index, 'userWalletId', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user wallet" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingUserWallets ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                  ) : userWalletsData?.data && userWalletsData.data.length > 0 ? (
                                    userWalletsData.data.map((uw) => (
                                      <SelectItem key={uw.id} value={uw.id!.toString()}>
                                        {uw.userName} - {uw.customWalletName}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No user wallets available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          ) : (
                            <>
                              <Label>Custom Wallet</Label>
                              <Select
                                key={`custom-${index}`}
                                value={wallet.customWalletId?.toString() || ''}
                                onValueChange={(value) => updateWallet(index, 'customWalletId', parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select custom wallet" />
                                </SelectTrigger>
                                <SelectContent>
                                  {isLoadingCustomWallets ? (
                                    <SelectItem value="loading" disabled>Loading...</SelectItem>
                                  ) : customWalletsData?.data && customWalletsData.data.length > 0 ? (
                                    customWalletsData.data.map((cw) => (
                                      <SelectItem key={cw.id} value={cw.id!.toString()}>
                                        {cw.name} - {cw.type}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>No custom wallets available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Direction</Label>
                          <Select
                            value={wallet.direction || 'in'}
                            onValueChange={(value) => updateWallet(index, 'direction', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in">In</SelectItem>
                              <SelectItem value="out">Out</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={wallet.percentage}
                            onChange={(e) =>
                              updateWallet(index, 'percentage', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2 self-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeWallet(index)}
                            className="h-10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                    <CardDescription>Select addons and set custom pricing</CardDescription>
                  </div>
                  <Popover open={addonPopoverOpen} onOpenChange={setAddonPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" disabled={isLoadingAddons}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Addon
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search addons..." />
                        <CommandEmpty>No addon found.</CommandEmpty>
                        <CommandGroup className="max-h-64 overflow-auto">
                          {addonsData?.data?.map((addon: Addon) => (
                            <CommandItem
                              key={addon.id}
                              value={addon.name}
                              onSelect={() => {
                                if (!selectedAddons.find(a => a.addonId === addon.id)) {
                                  setSelectedAddons(prev => [...prev, { addonId: addon.id!, price: addon.price, number: 1 }]);
                                }
                                setAddonPopoverOpen(false);
                              }}
                            >
                              {addon.name} - ${addon.price}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedAddons.map((selectedAddon, index) => {
                  const addon = addonsData?.data?.find((a: Addon) => a.id === selectedAddon.addonId);
                  return addon ? (
                    <Card key={selectedAddon.addonId}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <Label>Addon</Label>
                            <Input value={addon.name} disabled />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label>Custom Price</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={selectedAddon.price}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value) || 0;
                                setSelectedAddons(prev =>
                                  prev.map((a, i) => i === index ? { ...a, price: newPrice } : a)
                                );
                              }}
                              placeholder={`Default: $${addon.price}`}
                            />
                          </div>
                          <div className="w-24 space-y-2">
                            <Label>Number</Label>
                            <Input
                              type="number"
                              min="1"
                              value={selectedAddon.number}
                              onChange={(e) => {
                                const newNumber = parseInt(e.target.value) || 1;
                                setSelectedAddons(prev =>
                                  prev.map((a, i) => i === index ? { ...a, number: newNumber } : a)
                                );
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAddons(prev => prev.filter((_, i) => i !== index))}
                            className="mt-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground mt-2">{addon.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ) : null;
                })}
                {selectedAddons.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No addons added yet. Click "Add Addon" to select from available addons.
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
