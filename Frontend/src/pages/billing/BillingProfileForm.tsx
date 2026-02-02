import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, Wallet, Package, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  getProfiles,
  createProfile,
  updateProfile,
  type BillingProfile,
  type CreateBillingProfileRequest,
  type BillingProfileWallet,
  type BillingProfileAddon,
} from '../../api/billingProfiles';
import { radiusProfileApi } from '../../api/radiusProfileApi';
import { getGroups } from '../../api/groups';
import { addonApi, type Addon } from '../../api/addons';
import { customWalletApi } from '../../api/customWallets';
import userWalletApi from '../../api/userWallets';
import { userManagementApi } from '../../api/userManagementApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../../components/ui/command';
import { cn } from '../../lib/utils';
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper';

export default function BillingProfileForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentWorkspaceId } = useWorkspace();
  const profileId = searchParams.get('profileId');
  const queryClient = useQueryClient();
  const { layout } = useTheme();

  console.log('BillingProfileForm - profileId from URL:', profileId);

  const [formData, setFormData] = useState<CreateBillingProfileRequest>({
    name: '',
    description: '',
    price: 0,
    radiusProfileId: 0,
    billingGroupId: 0,
    wallets: [],
    addons: [],
    // Advanced Options
    isOffer: false,
    platform: null,
    totalQuantity: null,
    userType: null,
    expirationDays: null,
    offerStartDate: null,
    offerEndDate: null,
    requiresApproval: false,
    priority: null,
    color: null,
    icon: null,
  });

  const [selectedRadiusProfiles, setSelectedRadiusProfiles] = useState<{profileId: number, number: number}[]>([]);
  const [selectedBillingGroups, setSelectedBillingGroups] = useState<number[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<{addonId: number, price: number, number: number}[]>([]);
  const [radiusProfilePopoverOpen, setRadiusProfilePopoverOpen] = useState(false);
  const [billingGroupPopoverOpen, setBillingGroupPopoverOpen] = useState(false);
  const [addonPopoverOpen, setAddonPopoverOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [selectAllGroups, setSelectAllGroups] = useState(false);
  const [focusedPriceInput, setFocusedPriceInput] = useState(false);

  const [wallets, setWallets] = useState<BillingProfileWallet[]>([]);
  const [addons, setAddons] = useState<BillingProfileAddon[]>([]);

  // Fetch existing profile if editing
  const { data: existingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['billing-profile', profileId, currentWorkspaceId],
    queryFn: async () => {
      console.log('Fetching profile with ID:', profileId);
      const result = await getProfiles({ includeDeleted: false });
      console.log('All profiles:', result.data);
      const profile = result.data?.find(p => p.id === parseInt(profileId!));
      console.log('Found profile:', profile);
      return profile;
    },
    enabled: !!profileId && !!currentWorkspaceId,
  });

  console.log('Existing profile data:', existingProfile, 'Loading:', isLoadingProfile);

  // Load existing profile data
  useEffect(() => {
    if (existingProfile) {
      console.log('Loading profile - Color:', existingProfile.color, 'Icon:', existingProfile.icon);
      setFormData({
        name: existingProfile.name,
        description: existingProfile.description || '',
        price: existingProfile.price || 0,
        radiusProfileId: existingProfile.radiusProfileId,
        billingGroupId: existingProfile.billingGroupId,
        wallets: existingProfile.wallets || [],
        addons: existingProfile.addons || [],
        // Advanced Options
        isOffer: existingProfile.isOffer || false,
        platform: existingProfile.platform || null,
        totalQuantity: existingProfile.totalQuantity || null,
        userType: existingProfile.userType || null,
        expirationDays: existingProfile.expirationDays || null,
        offerStartDate: existingProfile.offerStartDate || null,
        offerEndDate: existingProfile.offerEndDate || null,
        requiresApproval: existingProfile.requiresApproval || false,
        priority: existingProfile.priority || null,
        color: existingProfile.color || null,
        icon: existingProfile.icon || null,
      });
      console.log('FormData after setting - Color:', existingProfile.color, 'Icon:', existingProfile.icon);
      setWallets(existingProfile.wallets || []);
      setSelectedRadiusProfiles([{profileId: existingProfile.radiusProfileId, number: 1}]);
      
      // Check if "All Groups" is selected (billingGroupId === 0 or null)
      const isAllGroups = existingProfile.billingGroupId === 0 || existingProfile.billingGroupId === null;
      setSelectAllGroups(isAllGroups);
      setSelectedBillingGroups(isAllGroups ? [] : [existingProfile.billingGroupId]);
      
      setSelectedAddons(
        existingProfile.addons?.map(a => ({ addonId: a.id!, price: a.price, number: 1 })) || []
      );
    }
  }, [existingProfile]);

  // Queries
  const { data: radiusProfilesData, isLoading: isLoadingRadiusProfiles } = useQuery({
    queryKey: ['radius-profiles', currentWorkspaceId],
    queryFn: async () => {
      const result = await radiusProfileApi.getAll(1, 1000);
      return result;
    },
    enabled: !!currentWorkspaceId,
  });

  const { data: billingGroupsData, isLoading: isLoadingBillingGroups } = useQuery({
    queryKey: ['billing-groups'],
    queryFn: async () => {
      const result = await getGroups({ includeDeleted: false });
      return result;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementApi.getAll(),
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
      navigate('/billing/profiles');
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
      navigate('/billing/profiles');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update billing profile';
      toast.error(errorMessage);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRadiusProfiles.length || selectedRadiusProfiles.length === 0) {
      toast.error('Please select at least one radius profile');
      return;
    }

    if (!selectAllGroups && selectedBillingGroups.length === 0) {
      toast.error('Please select at least one billing group or choose "All Groups"');
      return;
    }

    const submitData: CreateBillingProfileRequest = {
      ...formData,
      radiusProfileId: selectedRadiusProfiles[0]?.profileId || 0,
      billingGroupId: selectAllGroups ? 0 : selectedBillingGroups[0] || 0,
      wallets: wallets.map(w => ({
        walletType: w.walletType,
        userWalletId: w.walletType === 'user' ? w.userWalletId : undefined,
        customWalletId: w.walletType === 'custom' ? w.customWalletId : undefined,
        price: w.price || 0,
        direction: w.direction || 'in',
      })),
      addons: selectedAddons.map(sa => {
        const addon = addonsData?.data?.find((a: Addon) => a.id === sa.addonId);
        return {
          title: addon?.name || '',
          description: addon?.description || '',
          price: sa.price,
        };
      }),
    };

    console.log('Submit Data:', submitData);
    console.log('Color:', submitData.color, 'Icon:', submitData.icon);

    if (profileId) {
      updateMutation.mutate({ id: parseInt(profileId), data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const addWallet = () => {
    setWallets([
      ...wallets,
      {
        walletType: 'user',
        userWalletId: undefined,
        customWalletId: undefined,
        direction: 'in',
        price: 0,
      },
    ]);
  };

  const removeWallet = (index: number) => {
    setWallets(wallets.filter((_, i) => i !== index));
  };

  const updateWallet = (index: number, field: string, value: any) => {
    const updated = [...wallets];
    updated[index] = { ...updated[index], [field]: value };
    setWallets(updated);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {profileId ? 'Edit Billing Profile' : 'Create Billing Profile'}
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure billing profile with radius profile, billing group, wallets, and addons
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
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
                  type="text"
                  value={focusedPriceInput ? formData.price || '' : (formData.price ? formData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}
                  onChange={(e) => {
                    const value = e.target.value.replace(/,/g, '');
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setFormData({ ...formData, price: value === '' ? 0 : parseFloat(value) });
                    }
                  }}
                  onFocus={() => setFocusedPriceInput(true)}
                  onBlur={() => {
                    setFocusedPriceInput(false);
                    if (formData.price) {
                      setFormData({ ...formData, price: parseFloat(formData.price.toFixed(2)) });
                    }
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
                  if (!group) return null;
                  
                  const groupUsers = usersData?.filter(user => 
                    group.userIds?.includes(user.id)
                  ) || [];
                  
                  return (
                    <Card key={groupId}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium">{group.name}</div>
                            {group.description && (
                              <div className="text-sm text-muted-foreground mb-2">{group.description}</div>
                            )}
                            {groupUsers.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                <span className="font-medium">Users ({groupUsers.length}):</span>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {groupUsers.slice(0, 5).map((user: any) => (
                                    <span key={user.id} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs">
                                      {user.firstName} {user.lastName}
                                    </span>
                                  ))}
                                  {groupUsers.length > 5 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs">
                                      +{groupUsers.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
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
                  );
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
                        onValueChange={(value) => {
                          const updated = [...wallets];
                          updated[index] = {
                            ...updated[index],
                            direction: value,
                            // Reset price to 0 when selecting 'remaining'
                            ...(value === 'remaining' ? { price: 0 } : {})
                          };
                          setWallets(updated);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select direction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">In</SelectItem>
                          <SelectItem value="out">Out</SelectItem>
                          <SelectItem value="remaining">Remaining</SelectItem>
                        </SelectContent>
                      </Select>
                      {wallet.direction === 'in' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This will add the specified amount into the wallet
                        </p>
                      )}
                      {wallet.direction === 'out' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This will deduct the specified amount from the wallet
                        </p>
                      )}
                      {wallet.direction === 'remaining' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This will add the remaining money to the selected wallet
                        </p>
                      )}
                    </div>
                    {wallet.direction !== 'remaining' && (
                      <div className="space-y-2">
                        <Label>Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={wallet.price}
                          onChange={(e) =>
                            updateWallet(index, 'price', parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="h-10"
                        />
                      </div>
                    )}
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

        {/* Advanced Options */}
        <Card>
          <CardHeader>
            <CardTitle>Advanced Options</CardTitle>
            <CardDescription>Configure offer settings, platform availability, and other advanced features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Checkboxes */}
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <input
                  type="checkbox"
                  id="isOffer"
                  checked={formData.isOffer || false}
                  onChange={(e) => setFormData({ ...formData, isOffer: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isOffer" className="cursor-pointer font-medium">Is this an Offer?</Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border bg-muted/30">
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={formData.requiresApproval || false}
                  onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="requiresApproval" className="cursor-pointer font-medium">Requires Approval</Label>
              </div>
            </div>

            {/* Visual Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Visual Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Color */}
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Select
                    value={formData.color || '#3b82f6'}
                    onValueChange={(value) => setFormData({ ...formData, color: value })}
                  >
                    <SelectTrigger className="h-10">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-5 h-5 rounded-full border-2 shadow-sm" 
                          style={{ backgroundColor: formData.color || '#3b82f6' }}
                        />
                        <span className="font-medium">
                          {PREDEFINED_COLORS.find(c => c.value === formData.color)?.label || 'Blue'}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-5 h-5 rounded-full border-2 shadow-sm"
                              style={{ backgroundColor: color.value }}
                            />
                            <span className="font-medium">{color.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Icon */}
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <Popover open={iconPopoverOpen} onOpenChange={setIconPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start h-10" 
                        type="button"
                      >
                        {(() => {
                          const SelectedIcon = getIconComponent(formData.icon || undefined)
                          return <SelectedIcon className="w-4 h-4 mr-2" style={{ color: formData.color || '#3b82f6' }} />
                        })()}
                        <span className="font-medium">{formData.icon || 'Building2'}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-80 p-0" 
                      align="start"
                      style={{ zIndex: 9999 }}
                      sideOffset={5}
                    >
                      <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                        {AVAILABLE_ICONS.map((iconData) => {
                          const IconComponent = iconData.icon
                          const isSelected = formData.icon === iconData.name
                          return (
                            <button
                              key={iconData.name}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setFormData({ ...formData, icon: iconData.name })
                                setIconPopoverOpen(false)
                              }}
                              className={cn(
                                "p-2 rounded hover:bg-muted transition-colors",
                                isSelected && "bg-primary/10 ring-2 ring-primary"
                              )}
                              title={iconData.name}
                            >
                              <IconComponent className="w-5 h-5" style={{ color: formData.color || '#3b82f6' }} />
                            </button>
                          )
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Platform & User Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Platform & User Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Platform */}
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={formData.platform || 'Both'}
                    onValueChange={(value) => setFormData({ ...formData, platform: value === 'Both' ? null : value as any })}
                  >
                    <SelectTrigger id="platform">
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Both">Web & Mobile</SelectItem>
                      <SelectItem value="Web">Web Only</SelectItem>
                      <SelectItem value="MobileApp">Mobile App Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* User Type */}
                <div className="space-y-2">
                  <Label htmlFor="userType">User Type</Label>
                  <Select
                    value={formData.userType || 'Both'}
                    onValueChange={(value) => setFormData({ ...formData, userType: value === 'Both' ? null : value as any })}
                  >
                    <SelectTrigger id="userType">
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Both">New & Renew</SelectItem>
                      <SelectItem value="New">New Users Only</SelectItem>
                      <SelectItem value="Renew">Renew Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Quantity & Expiration */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quantity & Expiration</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Total Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="totalQuantity">Total Quantity</Label>
                  <Input
                    id="totalQuantity"
                    type="number"
                    value={formData.totalQuantity || ''}
                    onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                </div>

                {/* Expiration Days */}
                <div className="space-y-2">
                  <Label htmlFor="expirationDays">Expiration Days</Label>
                  <Input
                    id="expirationDays"
                    type="number"
                    value={formData.expirationDays || ''}
                    onChange={(e) => setFormData({ ...formData, expirationDays: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="No expiration"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
                </div>
              </div>
            </div>

            {/* Offer Duration */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Offer Duration</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Offer Start Date */}
                <div className="space-y-2">
                  <Label htmlFor="offerStartDate">Offer Start Date</Label>
                  <Input
                    id="offerStartDate"
                    type="datetime-local"
                    value={formData.offerStartDate ? new Date(formData.offerStartDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, offerStartDate: e.target.value ? e.target.value : null })}
                  />
                </div>

                {/* Offer End Date */}
                <div className="space-y-2">
                  <Label htmlFor="offerEndDate">Offer End Date</Label>
                  <Input
                    id="offerEndDate"
                    type="datetime-local"
                    value={formData.offerEndDate ? new Date(formData.offerEndDate).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, offerEndDate: e.target.value ? e.target.value : null })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/billing/profiles')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {profileId ? 'Update Profile' : 'Create Profile'}
          </Button>
        </div>
      </form>
    </div>
  );
}
