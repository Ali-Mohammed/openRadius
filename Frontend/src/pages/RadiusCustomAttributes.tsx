import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { radiusCustomAttributeApi, type RadiusCustomAttribute, type CreateRadiusCustomAttributeRequest, type UpdateRadiusCustomAttributeRequest } from '@/api/radiusCustomAttributeApi'
import { radiusUserApi } from '@/api/radiusUserApi'
import { radiusProfileApi } from '@/api/radiusProfileApi'
import { formatApiError } from '@/utils/errorHandler'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'

export default function RadiusCustomAttributes() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '50'))
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')
  const [linkTypeFilter, setLinkTypeFilter] = useState<'all' | 'user' | 'profile'>('all')
  const [includeDeleted, setIncludeDeleted] = useState(false)

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<RadiusCustomAttribute | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<number | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<number[]>([])

  // Form state
  const [formData, setFormData] = useState<CreateRadiusCustomAttributeRequest>({
    attributeName: '',
    attributeValue: '',
    attributeType: 0,
    operator: ':=',
    linkType: 'profile',
    priority: 0,
    enabled: true,
  })

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 50) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  // Fetch custom attributes
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['radiusCustomAttributes', currentPage, pageSize, searchQuery, linkTypeFilter, sortField, sortDirection, includeDeleted],
    queryFn: () => radiusCustomAttributeApi.getAll({
      page: currentPage,
      pageSize,
      search: searchQuery,
      linkType: linkTypeFilter !== 'all' ? linkTypeFilter : undefined,
      sortField,
      sortDirection,
      includeDeleted,
    }),
  })

  // Fetch users for dropdown
  const { data: usersData } = useQuery({
    queryKey: ['radiusUsers', 1, 1000],
    queryFn: () => radiusUserApi.getAll(1, 1000),
  })

  // Fetch profiles for dropdown
  const { data: profilesData } = useQuery({
    queryKey: ['radiusProfiles', 1, 1000],
    queryFn: () => radiusProfileApi.getAll(1, 1000),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute created successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRadiusCustomAttributeRequest }) =>
      radiusCustomAttributeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute updated successfully')
      setIsDialogOpen(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Custom attribute deleted successfully')
      setDeleteDialogOpen(false)
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: radiusCustomAttributeApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiusCustomAttributes'] })
      toast.success('Selected custom attributes deleted successfully')
      setSelectedAttributes([])
    },
    onError: (error) => {
      toast.error(formatApiError(error))
    },
  })

  const resetForm = () => {
    setFormData({
      attributeName: '',
      attributeValue: '',
      attributeType: 0,
      operator: ':=',
      linkType: 'profile',
      priority: 0,
      enabled: true,
    })
    setEditingAttribute(null)
  }

  const handleOpenDialog = (attribute?: RadiusCustomAttribute) => {
    if (attribute) {
      setEditingAttribute(attribute)
      setFormData({
        attributeName: attribute.attributeName,
        attributeValue: attribute.attributeValue,
        attributeType: attribute.attributeType,
        operator: attribute.operator,
        linkType: attribute.linkType,
        radiusUserId: attribute.radiusUserId,
        radiusProfileId: attribute.radiusProfileId,
        priority: attribute.priority,
        enabled: attribute.enabled,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = () => {
    if (editingAttribute) {
      updateMutation.mutate({ id: editingAttribute.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAttributes(data?.data.map(a => a.id) || [])
    } else {
      setSelectedAttributes([])
    }
  }

  const handleSelectAttribute = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedAttributes([...selectedAttributes, id])
    } else {
      setSelectedAttributes(selectedAttributes.filter(aid => aid !== id))
    }
  }

  const users = usersData?.data || []
  const profiles = profilesData?.data || []
  const attributes = data?.data || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Radius Custom Attributes</CardTitle>
              <CardDescription>
                Manage custom RADIUS attributes for users and profiles
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Attribute
              </Button>
              {selectedAttributes.length > 0 && (
                <Button
                  onClick={() => bulkDeleteMutation.mutate(selectedAttributes)}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedAttributes.length})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex gap-2 flex-1">
              <Input
                placeholder="Search attributes..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button onClick={handleSearch} variant="secondary" size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <Select value={linkTypeFilter} onValueChange={(v) => setLinkTypeFilter(v as 'all' | 'user' | 'profile')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Link Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="profile">Profiles</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                checked={includeDeleted}
                onCheckedChange={setIncludeDeleted}
                id="include-deleted"
              />
              <Label htmlFor="include-deleted">Show Deleted</Label>
            </div>

            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedAttributes.length === attributes.length && attributes.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('attributename')} className="h-8 p-0">
                      Attribute Name
                      {getSortIcon('attributename')}
                    </Button>
                  </TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('linktype')} className="h-8 p-0">
                      Link Type
                      {getSortIcon('linktype')}
                    </Button>
                  </TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('priority')} className="h-8 p-0">
                      Priority
                      {getSortIcon('priority')}
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : attributes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No custom attributes found
                    </TableCell>
                  </TableRow>
                ) : (
                  attributes.map((attribute) => (
                    <TableRow key={attribute.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedAttributes.includes(attribute.id)}
                          onCheckedChange={(checked) => handleSelectAttribute(attribute.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{attribute.attributeName}</TableCell>
                      <TableCell>{attribute.attributeValue}</TableCell>
                      <TableCell>
                        <Badge variant={attribute.attributeType === 0 ? 'default' : 'secondary'}>
                          {attribute.attributeType === 0 ? 'Reply' : 'Check'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">{attribute.operator}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={attribute.linkType === 'user' ? 'default' : 'outline'}>
                          {attribute.linkType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {attribute.linkType === 'user' ? attribute.radiusUsername : attribute.radiusProfileName}
                      </TableCell>
                      <TableCell>{attribute.priority}</TableCell>
                      <TableCell>
                        <Badge variant={attribute.enabled ? 'success' : 'secondary'}>
                          {attribute.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(attribute)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAttributeToDelete(attribute.id)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.totalCount)} of {pagination.totalCount} results
              </div>
              <div className="flex items-center gap-2">
                <Select value={pageSize.toString()} onValueChange={(v) => setPageSize(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center px-3 text-sm">
                    Page {currentPage} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(pagination.totalPages)}
                    disabled={currentPage === pagination.totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAttribute ? 'Edit' : 'Create'} Custom Attribute</DialogTitle>
            <DialogDescription>
              {editingAttribute ? 'Update the custom attribute details' : 'Add a new custom RADIUS attribute'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attributeName">Attribute Name *</Label>
                <Input
                  id="attributeName"
                  value={formData.attributeName}
                  onChange={(e) => setFormData({ ...formData, attributeName: e.target.value })}
                  placeholder="e.g., Alc-SLA-Prof-Str"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attributeValue">Attribute Value *</Label>
                <Input
                  id="attributeValue"
                  value={formData.attributeValue}
                  onChange={(e) => setFormData({ ...formData, attributeValue: e.target.value })}
                  placeholder="e.g., P1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="attributeType">Type</Label>
                <Select
                  value={formData.attributeType?.toString()}
                  onValueChange={(v) => setFormData({ ...formData, attributeType: parseInt(v) })}
                >
                  <SelectTrigger id="attributeType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Reply</SelectItem>
                    <SelectItem value="1">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operator">Operator</Label>
                <Select
                  value={formData.operator}
                  onValueChange={(v) => setFormData({ ...formData, operator: v })}
                >
                  <SelectTrigger id="operator">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=":=">:=</SelectItem>
                    <SelectItem value="=">=</SelectItem>
                    <SelectItem value="==">=</SelectItem>
                    <SelectItem value="+=">=</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkType">Link Type *</Label>
              <Select
                value={formData.linkType}
                onValueChange={(v: 'user' | 'profile') => {
                  setFormData({ 
                    ...formData, 
                    linkType: v,
                    radiusUserId: undefined,
                    radiusProfileId: undefined,
                  })
                }}
              >
                <SelectTrigger id="linkType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="profile">Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.linkType === 'user' ? (
              <div className="space-y-2">
                <Label htmlFor="radiusUserId">Radius User *</Label>
                <Combobox
                  options={users.map((u) => ({
                    value: u.id?.toString() || '',
                    label: u.username || `User ${u.id}`,
                  }))}
                  value={formData.radiusUserId?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, radiusUserId: parseInt(v) })}
                  placeholder="Select user..."
                  searchPlaceholder="Search users..."
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="radiusProfileId">Radius Profile *</Label>
                <Combobox
                  options={profiles.map((p) => ({
                    value: p.id?.toString() || '',
                    label: p.name || `Profile ${p.id}`,
                  }))}
                  value={formData.radiusProfileId?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, radiusProfileId: parseInt(v) })}
                  placeholder="Select profile..."
                  searchPlaceholder="Search profiles..."
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingAttribute ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the custom attribute. This action can be undone by restoring the attribute.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => attributeToDelete && deleteMutation.mutate(attributeToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
