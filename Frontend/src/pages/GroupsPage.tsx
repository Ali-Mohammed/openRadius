import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userManagementApi } from '@/api/userManagementApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from "sonner"
import { Plus, Trash2, Pencil, 
  Star, Heart, Zap, Trophy, Crown, Shield, Users as UsersIcon, User, Building, Briefcase, Rocket, Target, Award, Medal, Flag, 
  CheckCircle, XCircle, AlertCircle, Info, Settings, Home, Mail, Phone, Calendar, Clock, DollarSign, CreditCard, 
  ShoppingCart, Package, Truck, MapPin, Globe, Wifi, Database, Server, Cloud, Lock, Key, Eye, Bell, MessageCircle, 
  Send, Bookmark, FileText, Folder, Download, Upload, Share, Link, Layers, Grid, List, Filter, Search, MoreHorizontal, 
  Circle, Square, Triangle, Diamond, Hexagon, Octagon, Sparkles, Coffee, Music, Camera, Image, Video, Mic, 
  Headphones, Speaker, Monitor, Smartphone, Tablet, Watch, Printer, Cpu, HardDrive, Battery, Bluetooth, Radio, Rss
} from "lucide-react"

const PREDEFINED_COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#14b8a6', label: 'Teal' },
]

const AVAILABLE_ICONS = [
  { name: 'UsersIcon', icon: UsersIcon },
  { name: 'User', icon: User },
  { name: 'Building', icon: Building },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Shield', icon: Shield },
  { name: 'Star', icon: Star },
  { name: 'Heart', icon: Heart },
  { name: 'Zap', icon: Zap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Crown', icon: Crown },
  { name: 'Rocket', icon: Rocket },
  { name: 'Target', icon: Target },
  { name: 'Award', icon: Award },
  { name: 'Medal', icon: Medal },
  { name: 'Flag', icon: Flag },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'AlertCircle', icon: AlertCircle },
  { name: 'Info', icon: Info },
  { name: 'Settings', icon: Settings },
  { name: 'Home', icon: Home },
  { name: 'Mail', icon: Mail },
  { name: 'Phone', icon: Phone },
  { name: 'Calendar', icon: Calendar },
  { name: 'Clock', icon: Clock },
  { name: 'DollarSign', icon: DollarSign },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Package', icon: Package },
  { name: 'Truck', icon: Truck },
  { name: 'MapPin', icon: MapPin },
  { name: 'Globe', icon: Globe },
  { name: 'Wifi', icon: Wifi },
  { name: 'Database', icon: Database },
  { name: 'Server', icon: Server },
  { name: 'Cloud', icon: Cloud },
  { name: 'Lock', icon: Lock },
  { name: 'Key', icon: Key },
  { name: 'Eye', icon: Eye },
  { name: 'Bell', icon: Bell },
  { name: 'MessageCircle', icon: MessageCircle },
  { name: 'Send', icon: Send },
  { name: 'Bookmark', icon: Bookmark },
  { name: 'FileText', icon: FileText },
  { name: 'Folder', icon: Folder },
  { name: 'Download', icon: Download },
  { name: 'Upload', icon: Upload },
  { name: 'Share', icon: Share },
  { name: 'Link', icon: Link },
  { name: 'Layers', icon: Layers },
  { name: 'Grid', icon: Grid },
  { name: 'List', icon: List },
  { name: 'Filter', icon: Filter },
  { name: 'Search', icon: Search },
  { name: 'MoreHorizontal', icon: MoreHorizontal },
  { name: 'Circle', icon: Circle },
  { name: 'Square', icon: Square },
  { name: 'Triangle', icon: Triangle },
  { name: 'Diamond', icon: Diamond },
  { name: 'Hexagon', icon: Hexagon },
  { name: 'Octagon', icon: Octagon },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Camera', icon: Camera },
  { name: 'Image', icon: Image },
  { name: 'Video', icon: Video },
  { name: 'Mic', icon: Mic },
  { name: 'Headphones', icon: Headphones },
  { name: 'Speaker', icon: Speaker },
  { name: 'Monitor', icon: Monitor },
  { name: 'Smartphone', icon: Smartphone },
  { name: 'Tablet', icon: Tablet },
  { name: 'Watch', icon: Watch },
  { name: 'Printer', icon: Printer },
  { name: 'Cpu', icon: Cpu },
  { name: 'HardDrive', icon: HardDrive },
  { name: 'Battery', icon: Battery },
  { name: 'Bluetooth', icon: Bluetooth },
  { name: 'Radio', icon: Radio },
  { name: 'Rss', icon: Rss },
]

// Helper function to get icon component
const getIconComponent = (iconName?: string | null) => {
  if (!iconName) return UsersIcon
  const iconData = AVAILABLE_ICONS.find(i => i.name === iconName)
  return iconData?.icon || UsersIcon
}

interface Group {
  id: number
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
  createdAt: string
}

export default function GroupsPage() {
  const queryClient = useQueryClient()
  const [showDialog, setShowDialog] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
    icon: 'UsersIcon',
    color: '#3b82f6'
  })
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ['groups', showDeleted],
    queryFn: () => userManagementApi.getGroups(showDeleted),
  })

  const createGroupMutation = useMutation({
    mutationFn: userManagementApi.createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      handleCloseDialog()
      toast.success('Group created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create group')
    },
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      userManagementApi.updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      handleCloseDialog()
      toast.success('Group updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update group')
    },
  })

  const deleteGroupMutation = useMutation({
    mutationFn: userManagementApi.deleteGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      setDeletingGroup(null)
      toast.success('Group deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete group')
    },
  })

  const confirmDelete = () => {
    if (deletingGroup) {
      deleteGroupMutation.mutate(deletingGroup.id)
    }
  }

  const restoreGroupMutation = useMutation({
    mutationFn: userManagementApi.restoreGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] })
      toast.success('Group restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to restore group')
    },
  })

  const handleOpenDialog = (group?: Group) => {
    if (group) {
      setEditingGroup(group)
      setGroupForm({
        name: group.name,
        description: group.description || '',
        icon: group.icon || 'UsersIcon',
        color: group.color || '#3b82f6'
      })
    } else {
      setEditingGroup(null)
      setGroupForm({
        name: '',
        description: '',
        icon: 'UsersIcon',
        color: '#3b82f6'
      })
    }
    setShowDialog(true)
  }

  const handleCloseDialog = () => {
    setShowDialog(false)
    setEditingGroup(null)
    setIconPopoverOpen(false)
  }

  const handleSubmit = () => {
    if (!groupForm.name.trim()) {
      toast.error('Group name is required')
      return
    }

    if (editingGroup) {
      updateGroupMutation.mutate({
        id: editingGroup.id,
        data: groupForm
      })
    } else {
      createGroupMutation.mutate(groupForm)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="text-muted-foreground">Organize users into groups for easier management</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "secondary" : "outline"}
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {showDeleted ? 'Show Active' : 'Show Deleted'}
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => {
            const IconComponent = getIconComponent(group.icon)
            const groupColor = group.color || '#3b82f6'
            
            return (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="p-2.5 rounded-lg flex items-center justify-center" 
                        style={{ backgroundColor: `${groupColor}15`, color: groupColor }}
                      >
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="mt-1 line-clamp-2">{group.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreGroupMutation.mutate(group.id)}
                          disabled={restoreGroupMutation.isPending}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(group)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingGroup(group)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}

          {groups.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="text-center py-12">
                <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No groups created yet. Click "Add Group" to create one.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
            <DialogDescription>
              {editingGroup ? 'Update group details' : 'Add a new group to organize your users'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g., Engineering, Sales, Support"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="group-desc">Description</Label>
              <Textarea
                id="group-desc"
                placeholder="Brief description of this group"
                value={groupForm.description}
                onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Color</Label>
                <Select
                  value={groupForm.color}
                  onValueChange={(value) => setGroupForm({ ...groupForm, color: value })}
                >
                  <SelectTrigger>
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded" style={{ backgroundColor: groupForm.color }} />
                      <span>{PREDEFINED_COLORS.find(c => c.value === groupForm.color)?.label || 'Blue'}</span>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {PREDEFINED_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded border" style={{ backgroundColor: color.value }} />
                          <span>{color.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Icon</Label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                  >
                    {(() => {
                      const IconComponent = getIconComponent(groupForm.icon)
                      return (
                        <div className="flex items-center gap-2">
                          <div 
                            className="rounded-lg p-1.5 flex items-center justify-center"
                            style={{ backgroundColor: `${groupForm.color}15`, color: groupForm.color }}
                          >
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <span className="truncate">{groupForm.icon}</span>
                        </div>
                      )
                    })()}
                  </Button>
                  {iconPopoverOpen && (
                    <div className="absolute z-50 mt-1 w-[320px] rounded-md border bg-popover p-4 text-popover-foreground shadow-md right-0">
                      <div className="grid grid-cols-6 gap-2 max-h-[240px] overflow-y-auto">
                        {AVAILABLE_ICONS.map(({ name, icon: Icon }) => (
                          <Button
                            key={name}
                            type="button"
                            variant={groupForm.icon === name ? "default" : "outline"}
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => {
                              setGroupForm({ ...groupForm, icon: name })
                              setIconPopoverOpen(false)
                            }}
                            title={name}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!groupForm.name.trim() || createGroupMutation.isPending || updateGroupMutation.isPending}
            >
              {(createGroupMutation.isPending || updateGroupMutation.isPending) ? 'Saving...' : (editingGroup ? 'Update Group' : 'Create Group')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingGroup?.name}"? This action can be undone later by restoring the group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
