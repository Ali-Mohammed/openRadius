import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Plus, Trash2, Edit } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '@/utils/iconColorHelper'

interface RadiusTag {
  id: number
  title: string
  description?: string
  status: string
  color: string
  icon?: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  isDeleted: boolean
  usersCount?: number
}

export default function RadiusTags() {
  const { id: workspaceId } = useParams()
  const queryClient = useQueryClient()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<RadiusTag | null>(null)
  const [newTagTitle, setNewTagTitle] = useState('')
  const [newTagDescription, setNewTagDescription] = useState('')
  const [newTagStatus, setNewTagStatus] = useState('active')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [newTagIcon, setNewTagIcon] = useState('Tag')
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['radiusTags', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workspace/${workspaceId}/radius/tags`)
      return response.data
    },
  })

  const createTagMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; status: string; color: string; icon?: string }) => {
      const response = await apiClient.post(`/api/workspace/${workspaceId}/radius/tags`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusTags', workspaceId] })
      setShowCreateDialog(false)
      resetForm()
      toast.success('Tag created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create tag')
    },
  })

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiClient.put(`/api/workspace/${workspaceId}/radius/tags/${id}`, data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusTags', workspaceId] })
      setShowEditDialog(false)
      setEditingTag(null)
      resetForm()
      toast.success('Tag updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update tag')
    },
  })

  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/api/workspace/${workspaceId}/radius/tags/${id}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusTags', workspaceId] })
      toast.success('Tag deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete tag')
    },
  })

  const restoreTagMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/api/workspace/${workspaceId}/radius/tags/${id}/restore`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusTags', workspaceId] })
      toast.success('Tag restored successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to restore tag')
    },
  })

  const resetForm = () => {
    setNewTagTitle('')
    setNewTagDescription('')
    setNewTagStatus('active')
    setNewTagIcon('Tag')
    setNewTagColor('#3b82f6')
  }

  const handleCreate = () => {
    createTagMutation.mutate({
      title: newTagTitle,
      description: newTagDescription,
      status: newTagStatus,
      icon: newTagIcon,
      color: newTagColor,
    })
  }

  const handleEdit = (tag: RadiusTag) => {
    setEditingTag(tag)
    setNewTagTitle(tag.title)
    setNewTagDescription(tag.description || '')
    setNewTagIcon(tag.icon || 'Tag')
    setNewTagStatus(tag.status)
    setNewTagColor(tag.color)
    setShowEditDialog(true)
  }

  const handleUpdate = () => {
    if (!editingTag) return
    updateTagMutation.mutate({
      id: editingTag.id,
      data: {
        title: newTagTitle,
        description: newTagDescription,
        status: newTagStatus,
        color: newTagColor,
        icon: newTagIcon,
      },
    })
  }



  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-9 w-48 bg-muted animate-pulse rounded" />
            <div className="h-5 w-96 bg-muted animate-pulse rounded mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RADIUS Tags</h1>
          <p className="text-muted-foreground mt-1">Organize and manage your RADIUS users with custom tags</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Create Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-primary/10 p-6 mb-4">
              <TagIcon className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No tags yet</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              Get started by creating your first tag to organize your RADIUS users
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Tag
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag: RadiusTag) => {
            const IconComponent = getIconComponent(tag.icon)
            return (
              <Card 
                key={tag.id} 
                className={`transition-all hover:shadow-lg ${
                  tag.isDeleted ? 'opacity-50' : 'hover:border-primary/50'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div 
                        className="rounded-lg p-2.5 flex-shrink-0"
                        style={{ 
                          backgroundColor: `${tag.color}15`,
                          color: tag.color 
                        }}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg mb-1 truncate">{tag.title}</CardTitle>
                        {tag.description && (
                          <CardDescription className="line-clamp-2">{tag.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    {!tag.isDeleted && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          onClick={() => handleEdit(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deleteTagMutation.mutate(tag.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={tag.status === 'active' ? 'default' : 'secondary'}
                        className="font-medium"
                      >
                        {tag.status}
                      </Badge>
                      {tag.isDeleted && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          onClick={() => restoreTagMutation.mutate(tag.id)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-medium">{tag.usersCount ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Tag Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Create New Tag</DialogTitle>
            <DialogDescription>
              Create a custom tag to organize and categorize your RADIUS users
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., VIP Users, Premium Members, Corporate Access"
                value={newTagTitle}
                onChange={(e) => setNewTagTitle(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Input
                id="description"
                placeholder="Add a brief description (optional)"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                <Select value={newTagStatus} onValueChange={setNewTagStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✓ Active</SelectItem>
                    <SelectItem value="inactive">⊘ Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color" className="text-sm font-medium">Color</Label>
                <Select value={newTagColor} onValueChange={setNewTagColor}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border" 
                        style={{ backgroundColor: newTagColor }}
                      />
                      <span>
                        {PREDEFINED_COLORS.find(c => c.value === newTagColor)?.label || 'Select Color'}
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
            <div className="grid gap-2">
              <Label htmlFor="icon" className="text-sm font-medium">Icon</Label>
              <div className="relative">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  type="button"
                  onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                >
                  {(() => {
                    const SelectedIcon = getIconComponent(newTagIcon)
                    return <SelectedIcon className="w-4 h-4 mr-2" />
                  })()}
                  {newTagIcon}
                </Button>
                {iconPopoverOpen && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded-md shadow-lg z-50">
                    <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                      {AVAILABLE_ICONS.map((iconData) => {
                        const IconComponent = iconData.icon
                        const isSelected = newTagIcon === iconData.name
                        return (
                          <button
                            key={iconData.name}
                            type="button"
                            onClick={(e) => {
                              console.log('Icon clicked:', iconData.name)
                              e.preventDefault()
                              e.stopPropagation()
                              setNewTagIcon(iconData.name)
                              setIconPopoverOpen(false)
                            }}
                            onMouseEnter={() => console.log('Hovering:', iconData.name)}
                            className={`p-2 rounded flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
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
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCreateDialog(false)}
              className="gap-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTagTitle.trim() || createTagMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {createTagMutation.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Tag</DialogTitle>
            <DialogDescription>
              Update tag information and settings
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                placeholder="Enter tag title"
                value={newTagTitle}
                onChange={(e) => setNewTagTitle(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
              <Input
                id="edit-description"
                placeholder="Add a brief description (optional)"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-status" className="text-sm font-medium">Status</Label>
                <Select value={newTagStatus} onValueChange={setNewTagStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">✓ Active</SelectItem>
                    <SelectItem value="inactive">⊘ Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-color" className="text-sm font-medium">Color</Label>
                <Select value={newTagColor} onValueChange={setNewTagColor}>
                  <SelectTrigger className="h-10">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full border" 
                        style={{ backgroundColor: newTagColor }}
                      />
                      <span>
                        {PREDEFINED_COLORS.find(c => c.value === newTagColor)?.label || 'Select Color'}
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
            <div className="grid gap-2">
              <Label htmlFor="edit-icon" className="text-sm font-medium">Icon</Label>
              <div className="relative">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  type="button"
                  onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                >
                  {(() => {
                    const SelectedIcon = getIconComponent(newTagIcon)
                    return <SelectedIcon className="w-4 h-4 mr-2" />
                  })()}
                  {newTagIcon}
                </Button>
                {iconPopoverOpen && (
                  <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded-md shadow-lg z-50">
                    <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                      {AVAILABLE_ICONS.map((iconData) => {
                        const IconComponent = iconData.icon
                        const isSelected = newTagIcon === iconData.name
                        return (
                          <button
                            key={iconData.name}
                            type="button"
                            onClick={(e) => {
                              console.log('Icon clicked:', iconData.name)
                              e.preventDefault()
                              e.stopPropagation()
                              setNewTagIcon(iconData.name)
                              setIconPopoverOpen(false)
                            }}
                            onMouseEnter={() => console.log('Hovering:', iconData.name)}
                            className={`p-2 rounded flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 hover:bg-gray-200'
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
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)}
              className="gap-2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!newTagTitle.trim() || updateTagMutation.isPending}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              {updateTagMutation.isPending ? 'Updating...' : 'Update Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
