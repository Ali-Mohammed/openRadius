import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Save, RefreshCw, DollarSign, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cashbackGroupApi, type CashbackGroup } from '@/api/cashbackGroupApi';
import { getProfiles, type BillingProfile } from '@/api/billingProfiles';
import { cashbackProfileAmountApi } from '@/api/cashbackProfileAmounts';
import { userManagementApi, type User } from '@/api/userManagementApi';
import { workspaceApi } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getIconComponent } from '@/utils/iconColorHelper';

export default function GroupCashback() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});
  const [focusedInput, setFocusedInput] = useState<number | null>(null);

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

  // Fetch all active cashback groups
  const { data: groupsData, isLoading: isLoadingGroups } = useQuery({
    queryKey: ['cashback-groups-all', currentWorkspaceId],
    queryFn: async () => {
      const result = await cashbackGroupApi.getAll({
        page: 1,
        pageSize: 1000,
        onlyDeleted: false
      });
      return result.data;
    },
    enabled: !!currentWorkspaceId,
  });

  // Fetch all billing profiles
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['billing-profiles-all'],
    queryFn: () => getProfiles({ includeDeleted: false, isActive: true }),
  });

  // Fetch existing cashback amounts for selected group
  const { data: existingAmounts, isLoading: isLoadingAmounts } = useQuery({
    queryKey: ['cashback-amounts', selectedGroupId],
    queryFn: () => cashbackProfileAmountApi.getAmounts(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  // Fetch users in the selected cashback group
  const { data: groupUserIds } = useQuery({
    queryKey: ['cashback-group-users', selectedGroupId],
    queryFn: () => cashbackGroupApi.getGroupUsers(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  // Fetch user details for the group
  const { data: groupUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-details', groupUserIds],
    queryFn: async () => {
      if (!groupUserIds || groupUserIds.length === 0) return [];
      const userPromises = groupUserIds.map(id => userManagementApi.getById(id));
      return Promise.all(userPromises);
    },
    enabled: !!groupUserIds && groupUserIds.length > 0,
  });

  // Load existing amounts into state when data is fetched
  useEffect(() => {
    if (existingAmounts && existingAmounts.length > 0) {
      const amountsMap: Record<number, number> = {};
      existingAmounts.forEach(item => {
        amountsMap[item.billingProfileId] = item.amount;
      });
      setCashbackAmounts(prev => {
        if (JSON.stringify(prev) !== JSON.stringify(amountsMap)) {
          return amountsMap;
        }
        return prev;
      });
    } else if (selectedGroupId) {
      setCashbackAmounts({});
    }
  }, [existingAmounts, selectedGroupId]);

  // Mutation to save cashback amounts
  const saveMutation = useMutation({
    mutationFn: cashbackProfileAmountApi.saveAmounts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-amounts', selectedGroupId] });
      toast.success('Cashback amounts saved successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to save cashback amounts')
        : 'Failed to save cashback amounts';
      toast.error(errorMessage);
    }
  });

  // Mutation to reset cashback amounts
  const resetMutation = useMutation({
    mutationFn: cashbackProfileAmountApi.resetGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashback-amounts', selectedGroupId] });
      setCashbackAmounts({});
      toast.success('All cashback amounts reset successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to reset cashback amounts')
        : 'Failed to reset cashback amounts';
      toast.error(errorMessage);
    }
  });

  const handleCashbackChange = (profileId: number, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      const numAmount = value === '' ? 0 : parseFloat(value);
      setCashbackAmounts(prev => ({
        ...prev,
        [profileId]: numAmount
      }));
    }
  };

  const formatCashbackValue = (profileId: number) => {
    const value = cashbackAmounts[profileId];
    if (!value) return '';
    
    if (focusedInput === profileId) {
      return value.toString();
    }
    
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handleSave = () => {
    if (!selectedGroupId) {
      toast.error('Please select a cashback group');
      return;
    }

    const amounts = Object.entries(cashbackAmounts)
      .map(([billingProfileId, amount]) => ({
        billingProfileId: parseInt(billingProfileId),
        amount: amount
      }))
      .filter(item => item.amount > 0);

    saveMutation.mutate({
      cashbackGroupId: selectedGroupId,
      amounts: amounts
    });
  };

  const handleReset = () => {
    if (!selectedGroupId) {
      toast.error('Please select a cashback group');
      return;
    }

    resetMutation.mutate(selectedGroupId);
  };

  const selectedGroup = groupsData?.find((g: CashbackGroup) => g.id === selectedGroupId);
  const selectedGroupIcon = selectedGroup?.icon;
  const IconComponent = selectedGroupIcon ? getIconComponent(selectedGroupIcon) : null;

  return (
    <div className="space-y-4">
      {/* Group Selection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select Cashback Group</CardTitle>
          <CardDescription className="text-sm">
            Choose a cashback group to configure amounts for its billing profiles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Cashback Group *</Label>
            <Select
              value={selectedGroupId?.toString() || ''}
              onValueChange={(value) => setSelectedGroupId(parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a cashback group" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingGroups ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : groupsData && groupsData.length > 0 ? (
                  groupsData.map((group: CashbackGroup) => {
                    const GroupIcon = getIconComponent(group.icon);
                    return (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        <div className="flex items-center gap-2">
                          {GroupIcon && (
                            <div style={{ color: group.color }}>
                              <GroupIcon className="h-4 w-4" />
                            </div>
                          )}
                          <span>{group.name}</span>
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="none" disabled>No cashback groups available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedGroup && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-muted/50 to-muted rounded-lg border">
              {IconComponent && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg shadow-sm"
                  style={{ backgroundColor: selectedGroup.color + '20', color: selectedGroup.color }}
                >
                  <IconComponent className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-base">{selectedGroup.name}</h3>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {groupUsers?.length || 0} {groupUsers?.length === 1 ? 'User' : 'Users'}
                  </span>
                </div>
                {groupUsers && groupUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-muted-foreground text-xs shrink-0">Members:</span>
                    <div className="flex flex-wrap gap-1">
                      {groupUsers.slice(0, 3).map((user: User) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center rounded-md bg-background border px-1.5 py-0.5 text-xs"
                        >
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email || `User ${user.id}`}
                        </span>
                      ))}
                      {groupUsers.length > 3 && (
                        <span className="inline-flex items-center rounded-md bg-background border px-1.5 py-0.5 text-xs text-muted-foreground">
                          +{groupUsers.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {isLoadingUsers && (
                  <p className="text-xs text-muted-foreground">Loading members...</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedGroupId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Cashback Configuration</CardTitle>
                <CardDescription className="text-sm">
                  Set cashback amounts for each billing profile
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={resetMutation.isPending}>
                      {resetMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      Reset All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset All Cashback Amounts</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reset all cashback amounts for this group to zero. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleReset}>Reset All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-[200px]">Cashback Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingProfiles || isLoadingAmounts ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : profilesData?.data && profilesData.data.length > 0 ? (
                    profilesData.data
                      .filter((p: BillingProfile) => !p.isDeleted)
                      .map((profile: BillingProfile) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">{profile.name}</TableCell>
                          <TableCell className="max-w-md truncate">
                            {profile.description || '-'}
                          </TableCell>
                          <TableCell>
                            {profile.price ? (
                              <span className="font-medium">
                                {currencySymbol}
                                {profile.price.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">{currencySymbol}</span>
                              <Input
                                type="text"
                                value={formatCashbackValue(profile.id)}
                                onChange={(e) => handleCashbackChange(profile.id, e.target.value)}
                                onFocus={() => setFocusedInput(profile.id)}
                                onBlur={() => {
                                  setFocusedInput(null);
                                  const val = cashbackAmounts[profile.id];
                                  if (val && val > 0) {
                                    setCashbackAmounts(prev => ({
                                      ...prev,
                                      [profile.id]: parseFloat(val.toFixed(2))
                                    }));
                                  }
                                }}
                                placeholder="0.00"
                                className="w-full"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No billing profiles found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedGroupId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-3">
              <DollarSign className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Group Selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Please select a cashback group to configure cashback amounts for billing profiles
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
