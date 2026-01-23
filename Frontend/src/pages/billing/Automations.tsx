import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ArchiveRestore, GitBranch, Archive, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  restoreAutomation,
  type Automation,
  type CreateAutomationRequest,
} from '../../api/automations';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { AVAILABLE_ICONS, PREDEFINED_COLORS, getIconComponent } from '../../utils/iconColorHelper';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', variant: 'secondary' as const },
  { value: 'active', label: 'Active', variant: 'default' as const },
  { value: 'paused', label: 'Paused', variant: 'outline' as const },
  { value: 'inactive', label: 'Inactive', variant: 'destructive' as const },
];

export default function Automations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  
  const [formData, setFormData] = useState<CreateAutomationRequest>({
    title: '',
    description: '',
    icon: 'Zap',
    color: '#3b82f6',
    status: 'draft',
    isActive: true,
  });

  const { data: activeAutomationsData, isLoading: isLoadingActive } = useQuery({
    queryKey: ['automations', 'active', search],
    queryFn: () => getAutomations({ search, includeDeleted: false }),
  });

  const { data: deletedAutomationsData, isLoading: isLoadingDeleted } = useQuery({
    queryKey: ['automations', 'deleted', search],
    queryFn: () => getAutomations({ search, includeDeleted: true }),
  });

  const createMutation = useMutation({
    mutationFn: createAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created successfully');
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Failed to create automation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateAutomationRequest }) =>
      updateAutomation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation updated successfully');
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Failed to update automation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to delete automation');
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreAutomation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation restored successfully');
    },
    onError: () => {
      toast.error('Failed to restore automation');
    },
  });

  const handleOpenDialog = (automation?: Automation) => {
    if (automation) {
      setEditingAutomation(automation);
      setFormData({
        title: automation.title,
        description: automation.description || '',
        icon: automation.icon || 'Zap',
        color: automation.color || '#3b82f6',
        status: automation.status,
        isActive: automation.isActive,
      });
    } else {
      setEditingAutomation(null);
      setFormData({
        title: '',
        description: '',
        icon: 'Zap',
        color: '#3b82f6',
        status: 'draft',
        isActive: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAutomation(null);
    setIconPopoverOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAutomation) {
      updateMutation.mutate({ id: editingAutomation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
    }
  };

  const handleRestore = (id: number) => {
    restoreMutation.mutate(id);
  };

  const activeAutomations = activeAutomationsData?.data || [];
  const deletedAutomations = deletedAutomationsData?.data?.filter((a: Automation) => a.isDeleted) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-sm text-muted-foreground">Manage billing automations and workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="active">
                <Zap className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="deleted">
                <Archive className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1">
            <Input
              placeholder="Search automations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <Button onClick={() => setSearch(search)} variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['automations'] })} variant="outline" size="icon" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => handleOpenDialog()} disabled={activeTab === 'deleted'}>
            <Plus className="h-4 w-4 mr-2" />
            Add Automation
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
                  <TableHead>Automation</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
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
                ) : activeAutomations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No automations found. Click "Add Automation" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  activeAutomations.map((automation) => {
                    const IconComponent = getIconComponent(automation.icon || 'Zap');
                    const statusOption = STATUS_OPTIONS.find(s => s.value === automation.status);
                    return (
                      <TableRow key={automation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-md"
                              style={{ backgroundColor: automation.color }}
                            >
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-medium">{automation.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {automation.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusOption?.variant}>
                            {statusOption?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={automation.isActive ? 'default' : 'secondary'}>
                            {automation.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/billing/automations/${automation.id}/designer`)}
                              title="Design Workflow"
                            >
                              <GitBranch className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(automation)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(automation.id)}
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
                  <TableHead>Automation</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead>Deleted By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDeleted ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : deletedAutomations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No deleted automations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  deletedAutomations.map((automation) => {
                    const IconComponent = getIconComponent(automation.icon || 'Zap');
                    const statusOption = STATUS_OPTIONS.find(s => s.value === automation.status);
                    return (
                      <TableRow key={automation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-8 w-8 items-center justify-center rounded-md"
                              style={{ backgroundColor: automation.color }}
                            >
                              <IconComponent className="h-4 w-4 text-white" />
                            </div>
                            <span className="font-medium">{automation.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {automation.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusOption?.variant}>
                            {statusOption?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {automation.createdBy || '-'}
                        </TableCell>
                        <TableCell>
                          {automation.deletedAt
                            ? new Date(automation.deletedAt).toLocaleString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {automation.deletedBy || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(automation.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingAutomation ? 'Edit Automation' : 'Create New Automation'}
              </DialogTitle>
              <DialogDescription>
                {editingAutomation
                  ? 'Update the automation details'
                  : 'Create a new automation for your billing system'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                  placeholder="Enter automation title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Enter automation description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                    >
                      {React.createElement(getIconComponent(formData.icon || 'Zap'), { className: "w-4 h-4 mr-2" })}
                      {formData.icon || 'Zap'}
                    </Button>
                    {iconPopoverOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50">
                        <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                          {AVAILABLE_ICONS.map((iconData) => {
                            const IconComponent = iconData.icon;
                            const isSelected = formData.icon === iconData.name;
                            return (
                              <button
                                key={iconData.name}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFormData({ ...formData, icon: iconData.name });
                                  setIconPopoverOpen(false);
                                }}
                                className={`p-2 rounded flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-blue-500 text-white' 
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <IconComponent className="w-4 h-4" />
                              </button>
                            );
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="isActive">Active Status</Label>
                  <Select
                    value={formData.isActive ? 'true' : 'false'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, isActive: value === 'true' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                {editingAutomation ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft delete the automation. You can restore it later from the
              Deleted tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
