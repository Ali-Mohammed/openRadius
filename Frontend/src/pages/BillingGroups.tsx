import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ArchiveRestore, Users, Archive, RefreshCw, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  restoreGroup,
  type BillingGroup,
  type CreateBillingGroupRequest,
} from '../api/groups';
import { userManagementApi } from '../api/userManagementApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
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
import { AVAILABLE_ICONS, PREDEFINED_COLORS, getIconComponent } from '../utils/iconColorHelper';

export default function BillingGroups() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BillingGroup | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  
  const [formData, setFormData] = useState<CreateBillingGroupRequest>({
    name: '',
    description: '',
    icon: 'Package',
    color: '#3b82f6',
    isActive: true,
    userIds: [],
  });

  const { data: activeGroupsData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['billing-groups', 'active', search],
    queryFn: () => getGroups({ search, includeDeleted: false }),
  });

  const { data: deletedGroupsData, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ['billing-groups', 'deleted', search],
    queryFn: () => getGroups({ search, includeDeleted: true }),
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-groups'] });
      toast.success('Group created successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to create group';
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateBillingGroupRequest }) =>
      updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-groups'] });
      toast.success('Group updated successfully');
      handleCloseDialog();
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update group';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-groups'] });
      toast.success('Group deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete group');
      setDeleteConfirmId(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-groups'] });
      toast.success('Group restored successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to restore group');
    },
  });

  const handleOpenDialog = (group?: BillingGroup) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        description: group.description || '',
        icon: group.icon || 'Package',
        color: group.color || '#3b82f6',
        isActive: group.isActive,
        userIds: group.userIds || [],
      });
      setSelectedUserIds(group.userIds || []);
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        description: '',
        icon: 'Package',
        color: '#3b82f6',
        isActive: true,
        userIds: [],
      });
      setSelectedUserIds([]);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingGroup(null);
    setUserSearch('');
    setSelectedUserIds([]);
    setFormData({
      name: '',
      description: '',
      icon: 'Package',
      color: '#3b82f6',
      isActive: true,
      userIds: [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one user');
      return;
    }
    
    const data = { ...formData, userIds: selectedUserIds };
    
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data });
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

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = usersData?.filter(user =>
    user.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(userSearch.toLowerCase())
  ) || [];

  const selectedUsers = usersData?.filter(user =>
    selectedUserIds.includes(user.id)
  ) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing Groups</h1>
          <p className="text-sm text-muted-foreground">Organize users into billing groups</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">
                <UserCog className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search groups..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => setSearch(search)} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['billing-groups'] })} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={activeTab === 'deleted'}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {activeTab === 'active' ? (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Status</TableHead>
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
                ) : activeGroupsData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No groups found
                    </TableCell>
                  </TableRow>
                ) : (
                  activeGroupsData?.data?.filter(g => !g.isDeleted).map((group) => {
                const IconComponent = getIconComponent(group.icon);
                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-md"
                          style={{ backgroundColor: group.color }}
                        >
                          <IconComponent className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-medium">{group.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {group.userCount || 0} users
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={group.isActive ? 'default' : 'secondary'}>
                        {group.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(group)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(group.id)}
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
              <TableHead>Users</TableHead>
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
            ) : deletedGroupsData?.data?.filter(g => g.isDeleted).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No deleted groups found
                </TableCell>
              </TableRow>
            ) : (
              deletedGroupsData?.data?.filter(g => g.isDeleted).map((group) => {
                const IconComponent = getIconComponent(group.icon);
                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="flex items-center gap-2 opacity-60">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-md"
                          style={{ backgroundColor: group.color }}
                        >
                          <IconComponent className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-medium">{group.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md truncate opacity-60">
                      {group.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {group.userCount || 0} users
                      </Badge>
                    </TableCell>
                    <TableCell className="opacity-60">
                      {group.deletedAt ? new Date(group.deletedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(group.id)}
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

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move the group to trash. You can restore it later from the Deleted Groups tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Group' : 'Add Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup
                ? 'Update the group details below'
                : 'Create a new billing group'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Name *
                </label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <div className="relative">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      type="button"
                      onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                    >
                      {React.createElement(getIconComponent(formData.icon), { className: "w-4 h-4 mr-2" })}
                      {formData.icon || 'Package'}
                    </Button>
                    {iconPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50">
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
                                className={`p-2 rounded flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                                style={{
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                title={iconData.name}
                              >
                                <IconComponent className="w-4 h-4" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Select
                    value={formData.color}
                    onValueChange={(value) =>
                      setFormData({ ...formData, color: value })
                    }
                  >
                    <SelectTrigger>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: formData.color }}
                        />
                        <span>
                          {PREDEFINED_COLORS.find(c => c.value === formData.color)?.label || 'Select Color'}
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_COLORS.map((color) => (
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
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked as boolean })
                  }
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Active
                </label>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">Users *</label>
                <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {selectedUserIds.length === 0
                        ? 'Select users'
                        : `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''} selected`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <div className="flex flex-col gap-2 p-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search users..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-2 rounded-md p-2 hover:bg-accent"
                          >
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                            <label
                              htmlFor={`user-${user.id}`}
                              className="flex-1 cursor-pointer text-sm"
                            >
                              <div className="font-medium">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {user.email}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedUsers.map((user) => (
                      <Badge key={user.id} variant="secondary">
                        {user.firstName} {user.lastName}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancel
              </Button>
              <Button type="submit">
                {editingGroup ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
