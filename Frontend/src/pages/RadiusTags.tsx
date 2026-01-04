import { useState } from 'react'
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
import { Plus, Trash2, Tag as TagIcon, Edit } from 'lucide-react'
import { apiClient } from '@/lib/api'

interface RadiusTag {
  id: number
  title: string
  description?: string
  status: string
  color: string
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  isDeleted: boolean
}

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

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['radiusTags', workspaceId],
    queryFn: async () => {
      const response = await apiClient.get(`/api/workspace/${workspaceId}/radius/tags`)
      return response.data
    },
  })

  const createTagMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; status: string; color: string }) => {
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
    setNewTagColor('#3b82f6')
  }

  const handleCreate = () => {
    createTagMutation.mutate({
      title: newTagTitle,
      description: newTagDescription,
      status: newTagStatus,
      color: newTagColor,
    })
  }

  const handleEdit = (tag: RadiusTag) => {
    setEditingTag(tag)
    setNewTagTitle(tag.title)
    setNewTagDescription(tag.description || '')
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
      },
    })
  }

  if (isLoading) {
    return <div className="p-6">Loading tags...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RADIUS Tags</h1>
          <p className="text-muted-foreground">Manage tags for organizing RADIUS users</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TagIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No tags created yet. Click "Add Tag" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag: RadiusTag) => (
            <Card key={tag.id} className={tag.isDeleted ? 'opacity-50' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <CardTitle className="text-lg">{tag.title}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {!tag.isDeleted && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tag)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTagMutation.mutate(tag.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {tag.description && (
                  <CardDescription>{tag.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={tag.status === 'active' ? 'default' : 'secondary'}>
                    {tag.status}
                  </Badge>
                  {tag.isDeleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreTagMutation.mutate(tag.id)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Tag Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Tag</DialogTitle>
            <DialogDescription>
              Add a new tag for organizing RADIUS users
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., VIP, Premium, Corporate"
                value={newTagTitle}
                onChange={(e) => setNewTagTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this tag"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={newTagStatus} onValueChange={setNewTagStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="color">Color</Label>
              <Select value={newTagColor} onValueChange={setNewTagColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newTagTitle.trim() || createTagMutation.isPending}
            >
              {createTagMutation.isPending ? 'Creating...' : 'Create Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tag Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>
              Update tag details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={newTagTitle}
                onChange={(e) => setNewTagTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={newTagStatus} onValueChange={setNewTagStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-color">Color</Label>
              <Select value={newTagColor} onValueChange={setNewTagColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!newTagTitle.trim() || updateTagMutation.isPending}
            >
              {updateTagMutation.isPending ? 'Updating...' : 'Update Tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
