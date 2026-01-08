import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Users as UsersIcon, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Package, Gift, Star, Zap, Crown, Trophy, Heart, Sparkles } from 'lucide-react';

const iconOptions = [
  { value: 'Package', label: 'Package', Icon: Package },
  { value: 'Gift', label: 'Gift', Icon: Gift },
  { value: 'Star', label: 'Star', Icon: Star },
  { value: 'Zap', label: 'Zap', Icon: Zap },
  { value: 'Crown', label: 'Crown', Icon: Crown },
  { value: 'Trophy', label: 'Trophy', Icon: Trophy },
  { value: 'Heart', label: 'Heart', Icon: Heart },
  { value: 'Sparkles', label: 'Sparkles', Icon: Sparkles },
];

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Green' },
  { value: '#ef4444', label: 'Red' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#06b6d4', label: 'Cyan' },
];

const getIconComponent = (iconName?: string) => {
  const icon = iconOptions.find((i) => i.value === iconName);
  return icon ? icon.Icon : UsersIcon;
};

export default function BillingGroups() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BillingGroup | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  
  const [formData, setFormData] = useState<CreateBillingGroupRequest>({
    name: '',
    description: '',
    icon: 'Package',
    color: '#3b82f6',
    isActive: true,
    userIds: [],
  });

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['billing-groups', search],
    queryFn: () => getGroups({ search }),
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
    onError: () => {
      toast.error('Failed to create group');
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
    onError: () => {
      toast.error('Failed to update group');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-groups'] });
      toast.success('Group deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete group');
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
        userIds: group.users?.map(u => u.id) || [],
      });
      setSelectedUserIds(group.users?.map(u => u.id) || []);
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
    if (confirm('Are you sure you want to delete this group?')) {
      deleteMutation.mutate(id);
    }
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
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Groups</h1>
          <p className="text-muted-foreground mt-1">
            Organize users into billing groups
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Group
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : groupsData?.items?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No groups found
                </TableCell>
              </TableRow>
            ) : (
              groupsData?.items?.map((group) => {
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
                      {(() => {
                        const IconComponent = getIconComponent(formData.icon)
                        return <IconComponent className="w-4 h-4 mr-2" />
                      })()}
                      {formData.icon || 'Package'}
                    </Button>
                    {iconPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border rounded-md shadow-lg z-50">
                        <div className="grid grid-cols-4 gap-1 p-2 max-h-[200px] overflow-y-auto">
                          {iconOptions.map((iconData) => {
                            const IconComponent = iconData.Icon
                            const isSelected = formData.icon === iconData.value
                            return (
                              <button
                                key={iconData.value}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setFormData({ ...formData, icon: iconData.value })
                                  setIconPopoverOpen(false)
                                }}
                                className={`p-2 rounded flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                                style={{
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                title={iconData.label}
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
                          {colorOptions.find(c => c.value === formData.color)?.label || 'Select Color'}
                        </span>
                      </div>
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
                <label className="text-sm font-medium">Users</label>
                <Popover open={isUserPopoverOpen} onOpenChange={setIsUserPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="justify-start"
                    >
                      <UsersIcon className="mr-2 h-4 w-4" />
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
