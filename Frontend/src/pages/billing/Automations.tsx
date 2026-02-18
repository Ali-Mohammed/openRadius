import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ArchiveRestore, GitBranch, Archive, RefreshCw, Zap, Clock, Timer, MousePointerClick, Play } from 'lucide-react';
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

const TRIGGER_TYPE_OPTIONS = [
  { value: 'on_requested', label: 'On Requested', icon: MousePointerClick, description: 'Triggered manually or via billing profile activation' },
  { value: 'on_action', label: 'On Action', icon: Play, description: 'Triggered by a system event (user created, payment, etc.)' },
  { value: 'scheduled', label: 'Scheduled', icon: Clock, description: 'Runs on a schedule — at a specific time or periodically' },
];

const SCHEDULE_TYPE_OPTIONS = [
  { value: 'at_time', label: 'At Specific Time', description: 'Run once at a specific date/time' },
  { value: 'periodic', label: 'Periodic', description: 'Run repeatedly at a fixed interval' },
];

const PERIODIC_INTERVAL_OPTIONS = [
  { value: 1, label: 'Every 1 minute' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 10, label: 'Every 10 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every 1 hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' },
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
    triggerType: 'on_requested',
    scheduleType: null,
    cronExpression: null,
    scheduleIntervalMinutes: null,
    scheduledTime: null,
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
        triggerType: automation.triggerType || 'on_requested',
        scheduleType: automation.scheduleType || null,
        cronExpression: automation.cronExpression || null,
        scheduleIntervalMinutes: automation.scheduleIntervalMinutes || null,
        scheduledTime: automation.scheduledTime || null,
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
        triggerType: 'on_requested',
        scheduleType: null,
        cronExpression: null,
        scheduleIntervalMinutes: null,
        scheduledTime: null,
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
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingActive ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : activeAutomations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
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
                          {(() => {
                            const triggerOpt = TRIGGER_TYPE_OPTIONS.find(t => t.value === automation.triggerType);
                            const TriggerIcon = triggerOpt?.icon || MousePointerClick;
                            return (
                              <div className="flex items-center gap-1.5">
                                <TriggerIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{triggerOpt?.label || automation.triggerType}</span>
                                {automation.triggerType === 'scheduled' && automation.scheduleType && (
                                  <Badge variant="outline" className="text-[10px] ml-1">
                                    {automation.scheduleType === 'periodic'
                                      ? `${automation.scheduleIntervalMinutes}m`
                                      : 'once'}
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
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

            <div className="grid gap-4 py-4 overflow-y-auto pr-1">
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

              {/* Trigger Type Configuration */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-semibold">Trigger Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TRIGGER_TYPE_OPTIONS.map((option) => {
                    const TriggerIcon = option.icon;
                    const isSelected = formData.triggerType === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          triggerType: option.value,
                          scheduleType: option.value === 'scheduled' ? 'periodic' : null,
                          cronExpression: null,
                          scheduleIntervalMinutes: option.value === 'scheduled' ? 5 : null,
                          scheduledTime: null,
                        })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <TriggerIcon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-primary' : ''}`}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_TYPE_OPTIONS.find(t => t.value === formData.triggerType)?.description}
                </p>
              </div>

              {/* Schedule Configuration — only visible for scheduled trigger */}
              {formData.triggerType === 'scheduled' && (
                <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                  <Label className="text-sm font-semibold">Schedule Configuration</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {SCHEDULE_TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          scheduleType: option.value,
                          scheduleIntervalMinutes: option.value === 'periodic' ? 5 : null,
                          scheduledTime: option.value === 'at_time' ? '' : null,
                          cronExpression: null,
                        })}
                        className={`flex flex-col items-start gap-1 p-3 rounded-md border transition-all ${
                          formData.scheduleType === option.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <span className={`text-sm font-medium ${formData.scheduleType === option.value ? 'text-primary' : ''}`}>
                          {option.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>

                  {formData.scheduleType === 'periodic' && (
                    <div className="space-y-2">
                      <Label htmlFor="interval">Run Interval</Label>
                      <Select
                        value={String(formData.scheduleIntervalMinutes || 5)}
                        onValueChange={(value) =>
                          setFormData({ ...formData, scheduleIntervalMinutes: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {PERIODIC_INTERVAL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={String(option.value)}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.scheduleType === 'at_time' && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">Scheduled Date & Time</Label>
                      <Input
                        id="scheduledTime"
                        type="datetime-local"
                        value={formData.scheduledTime ? formData.scheduledTime.slice(0, 16) : ''}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduledTime: e.target.value ? new Date(e.target.value).toISOString() : null })
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">The automation will execute once at this exact time</p>
                    </div>
                  )}

                  {formData.scheduleType === 'periodic' && (
                    <div className="space-y-2">
                      <Label htmlFor="cronExpression">Custom Cron Expression (optional)</Label>
                      <Input
                        id="cronExpression"
                        value={formData.cronExpression || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, cronExpression: e.target.value || null })
                        }
                        placeholder="e.g., 0 */5 * * * (every 5 minutes)"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">Leave empty to use the interval above, or provide a custom cron expression for advanced scheduling</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t shrink-0">
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
