import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cashbackGroupApi, type CashbackGroup } from '@/api/cashbackGroupApi';
import { getProfiles, type BillingProfile } from '@/api/billingProfiles';
import { workspaceApi } from '@/lib/api';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getIconComponent } from '@/utils/iconColorHelper';

export default function CashbackProfiles() {
  const { currentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [cashbackAmounts, setCashbackAmounts] = useState<Record<number, number>>({});

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
    queryFn: () => getProfiles({ includeDeleted: false }),
  });

  const handleCashbackChange = (profileId: number, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setCashbackAmounts(prev => ({
      ...prev,
      [profileId]: numAmount
    }));
  };

  const handleSave = () => {
    // TODO: Implement API call to save cashback amounts
    console.log('Saving cashback amounts:', {
      groupId: selectedGroupId,
      amounts: cashbackAmounts
    });
    toast.success('Cashback amounts saved successfully');
  };

  const selectedGroup = groupsData?.find((g: CashbackGroup) => g.id === selectedGroupId);
  const IconComponent = selectedGroup ? getIconComponent(selectedGroup.icon) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cashback Profile Configuration</CardTitle>
          <CardDescription>
            Select a cashback group and configure cashback amounts for each billing profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Cashback Group Selection */}
          <div className="space-y-2">
            <Label>Cashback Group *</Label>
            <Select
              value={selectedGroupId?.toString() || ''}
              onValueChange={(value) => setSelectedGroupId(parseInt(value))}
            >
              <SelectTrigger>
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

          {/* Selected Group Display */}
          {selectedGroup && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              {IconComponent && (
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: selectedGroup.color + '20', color: selectedGroup.color }}
                >
                  <IconComponent className="h-6 w-6" />
                </div>
              )}
              <div>
                <h3 className="font-semibold">{selectedGroup.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Configure cashback amounts for billing profiles
                </p>
              </div>
            </div>
          )}

          {/* Billing Profiles Table */}
          {selectedGroupId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Billing Profiles</h3>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Cashback Amounts
                </Button>
              </div>

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
                    {isLoadingProfiles ? (
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
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={cashbackAmounts[profile.id] || ''}
                                  onChange={(e) => handleCashbackChange(profile.id, e.target.value)}
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
            </div>
          )}

          {!selectedGroupId && (
            <div className="text-center py-12 text-muted-foreground">
              <p>Please select a cashback group to configure cashback amounts for billing profiles</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
