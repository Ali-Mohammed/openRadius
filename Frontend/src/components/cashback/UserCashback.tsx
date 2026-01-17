import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Save, RefreshCw, DollarSign, Users, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { userManagementApi, type User } from '@/api/userManagementApi';
import { getProfiles, type BillingProfile } from '@/api/billingProfiles';
import { userCashbackApi } from '@/api/userCashbackApi';
import { cashbackGroupApi } from '@/api/cashbackGroupApi';
import { workspaceApi } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

export default function UserCashback() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});
  const [focusedInput, setFocusedInput] = useState<number | null>(null);
  const [showResetDialog, setShowResetDialog] = useState(false);

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

  // Fetch all users
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users-all', currentWorkspaceId],
    queryFn: async () => {
      const users = await userManagementApi.getAll();
      return { data: users };
    },
    enabled: !!currentWorkspaceId,
  });

  // Fetch user IDs assigned to cashback groups
  const { data: assignedUserIds } = useQuery({
    queryKey: ['cashback-group-assigned-users', currentWorkspaceId],
    queryFn: () => cashbackGroupApi.getAssignedUserIds(),
    enabled: !!currentWorkspaceId,
  });

  // Fetch all billing profiles
  const { data: profilesData, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['billing-profiles-all'],
    queryFn: () => getProfiles({ includeDeleted: false, isActive: true }),
  });

  // Fetch existing cashback amounts for selected user
  const { data: existingAmounts, isLoading: isLoadingAmounts } = useQuery({
    queryKey: ['user-cashback-amounts', selectedUserId],
    queryFn: () => userCashbackApi.getByUser(selectedUserId!),
    enabled: !!selectedUserId,
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
    } else if (selectedUserId) {
      setCashbackAmounts({});
    }
  }, [existingAmounts, selectedUserId]);

  // Mutation to save cashback amounts
  const saveMutation = useMutation({
    mutationFn: userCashbackApi.save,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cashback-amounts', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['user-cashback-ids', currentWorkspaceId] });
      toast.success('User cashback amounts saved successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to save user cashback amounts')
        : 'Failed to save user cashback amounts';
      toast.error(errorMessage);
    }
  });

  // Mutation to reset cashback amounts
  const resetMutation = useMutation({
    mutationFn: userCashbackApi.deleteByUser,
    onSuccess: () => {
      setCashbackAmounts({});
      queryClient.invalidateQueries({ queryKey: ['user-cashback-amounts', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['user-cashback-ids', currentWorkspaceId] });
      toast.success('User cashback amounts reset successfully');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to reset user cashback amounts')
        : 'Failed to reset user cashback amounts';
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
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    const amounts = Object.entries(cashbackAmounts)
      .map(([billingProfileId, amount]) => ({
        billingProfileId: parseInt(billingProfileId),
        amount: amount
      }))
      .filter(item => item.amount > 0);

    saveMutation.mutate({
      userId: selectedUserId,
      amounts: amounts
    });
  };

  const handleReset = () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }

    setShowResetDialog(true);
  };

  const confirmReset = () => {
    if (selectedUserId) {
      resetMutation.mutate(selectedUserId);
    }
    setShowResetDialog(false);
  };

  const selectedUser = usersData?.data?.find((u: User) => u.id === selectedUserId);

  return (
    <div className="space-y-4">
      {/* User Selection Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Select User</CardTitle>
          <CardDescription className="text-sm">
            Choose a user to configure direct cashback amounts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>User *</Label>
            <Select
              value={selectedUserId?.toString() || ''}
              onValueChange={(value) => setSelectedUserId(parseInt(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingUsers ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : usersData?.data && usersData.data.length > 0 ? (
                  usersData.data.map((user: User) => {
                    const isInGroup = assignedUserIds?.includes(user.id) || false;
                    return (
                      <SelectItem 
                        key={user.id} 
                        value={user.id.toString()}
                        disabled={isInGroup}
                        className={cn(
                          isInGroup && "opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2 w-full">
                          {isInGroup && (
                            <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          )}
                          <span className={cn(
                            "flex-1",
                            isInGroup && "line-through"
                          )}>
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName} (${user.email})`
                              : user.email || `User ${user.id}`}
                          </span>
                          {isInGroup && (
                            <span className="text-xs text-blue-500 ml-auto">In group</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                ) : (
                  <SelectItem value="none" disabled>No users available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-muted/50 to-muted rounded-lg border">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg shadow-sm bg-primary/10">
                <span className="text-xl font-semibold text-primary">
                  {(selectedUser.firstName?.[0] || selectedUser.email?.[0] || 'U').toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base">
                  {selectedUser.firstName && selectedUser.lastName
                    ? `${selectedUser.firstName} ${selectedUser.lastName}`
                    : 'User'}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedUser.email && (
                    <span className="truncate">{selectedUser.email}</span>
                  )}
                  {selectedUser.phoneNumber && (
                    <>
                      <span>•</span>
                      <span>{selectedUser.phoneNumber}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Cashback Configuration</CardTitle>
                <CardDescription className="text-sm">
                  Set direct cashback amounts for each billing profile
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleReset} 
                  disabled={resetMutation.isPending || !Object.keys(cashbackAmounts).some(key => cashbackAmounts[parseInt(key)] > 0)}
                >
                  {resetMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reset
                </Button>
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

      {!selectedUserId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-3">
              <DollarSign className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No User Selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Please select a user to configure direct cashback amounts for billing profiles
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Cashback Amounts</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset all cashback amounts for this user? 
              This action will permanently delete all individual cashback settings and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
