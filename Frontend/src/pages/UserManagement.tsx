import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { 
  Pencil, RefreshCw, Download, Users, Shield, X, UserPlus, Key, UserX, UserCheck, UserCog, MapPin, 
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, ArrowUpDown, ArrowUp, ArrowDown,
  FileText, Building2
} from 'lucide-react'
import { userManagementApi, type User } from '@/api/userManagementApi'
import { zoneApi } from '@/services/zoneApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'

// Column definitions
const COLUMN_DEFINITIONS = {
  name: { label: 'Name', sortable: true, defaultWidth: 180 },
  email: { label: 'Email', sortable: true, defaultWidth: 220 },
  status: { label: 'Status', sortable: true, defaultWidth: 100 },
  supervisor: { label: 'Supervisor', sortable: true, defaultWidth: 180 },
  groups: { label: 'Groups', sortable: false, defaultWidth: 180 },
  roles: { label: 'Roles', sortable: false, defaultWidth: 180 },
  zones: { label: 'Zones', sortable: false, defaultWidth: 200 },
  defaultWorkspace: { label: 'Default Workspace', sortable: true, defaultWidth: 180 },
  workspaces: { label: 'Workspaces', sortable: false, defaultWidth: 200 },
}

const DEFAULT_COLUMN_VISIBILITY = {
  name: true,
  email: true,
  status: true,
  supervisor: true,
  groups: true,
  roles: true,
  zones: true,
  defaultWorkspace: true,
  workspaces: true,
}

const DEFAULT_COLUMN_ORDER = ['name', 'email', 'status', 'supervisor', 'groups', 'roles', 'zones', 'defaultWorkspace', 'workspaces', 'actions']

export default function UserManagement() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '')
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page') || '1'))
  const [pageSize, setPageSize] = useState(() => parseInt(searchParams.get('pageSize') || '25'))
  const [sortField, setSortField] = useState<string>(() => searchParams.get('sortField') || '')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDirection') as 'asc' | 'desc') || 'asc')
  
  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMN_VISIBILITY)
  const [columnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [isZoneDialogOpen, setIsZoneDialogOpen] = useState(false)
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false)
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  const [zoneAssignUser, setZoneAssignUser] = useState<User | null>(null)
  const [workspaceAssignUser, setWorkspaceAssignUser] = useState<User | null>(null)
  const [userToToggle, setUserToToggle] = useState<User | null>(null)
  const [disableReason, setDisableReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState(true)
  
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<number | undefined>(undefined)
  const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([])
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<number[]>([])
  const hasSetInitialZones = useRef(false)
  const hasSetInitialWorkspaces = useRef(false)
  
  // Form fields for creating a new user
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')

  const workspaceIdNum = parseInt(workspaceId || currentWorkspaceId?.toString() || '0')

  // Update URL params when state changes
  useEffect(() => {
    const params: Record<string, string> = {}
    if (currentPage !== 1) params.page = currentPage.toString()
    if (pageSize !== 25) params.pageSize = pageSize.toString()
    if (searchQuery) params.search = searchQuery
    if (sortField) params.sortField = sortField
    if (sortDirection !== 'asc') params.sortDirection = sortDirection
    setSearchParams(params, { replace: true })
  }, [currentPage, pageSize, searchQuery, sortField, sortDirection, setSearchParams])

  // Queries
  const { data: users = [], isLoading, isFetching } = useQuery({
    queryKey: ['users', searchQuery],
    queryFn: async () => {
      const data = await userManagementApi.getAll()
      return data
    },
    staleTime: 0,
    gcTime: 0,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => userManagementApi.getGroups(),
  })

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userManagementApi.getRoles(),
  })

  // Fetch zones for current workspace (flat list for assignment)
  const { data: zones = [] } = useQuery({
    queryKey: ['zones-flat', workspaceIdNum],
    queryFn: () => zoneApi.getZonesFlat(workspaceIdNum),
    enabled: !!workspaceIdNum,
  })

  // Fetch available workspaces for assignment
  const { data: availableWorkspaces = [] } = useQuery({
    queryKey: ['available-workspaces'],
    queryFn: () => userManagementApi.getAvailableWorkspaces(),
  })

  // Fetch user zones when dialog opens
  const { data: userZoneIds = [] } = useQuery({
    queryKey: ['user-zones', workspaceIdNum, zoneAssignUser?.id],
    queryFn: () => zoneAssignUser?.id && workspaceIdNum
      ? userManagementApi.getUserZones(workspaceIdNum, zoneAssignUser.id)
      : Promise.resolve([]),
    enabled: !!zoneAssignUser && isZoneDialogOpen && !!workspaceIdNum,
  })

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let result = [...users]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(user => 
        user.email?.toLowerCase().includes(query) ||
        user.firstName?.toLowerCase().includes(query) ||
        user.lastName?.toLowerCase().includes(query) ||
        `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(query)
      )
    }
    
    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let aVal: string | number, bVal: string | number
        switch (sortField) {
          case 'name':
            aVal = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase()
            bVal = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase()
            break
          case 'email':
            aVal = (a.email || '').toLowerCase()
            bVal = (b.email || '').toLowerCase()
            break
          case 'status':
            aVal = a.enabled !== false ? 1 : 0
            bVal = b.enabled !== false ? 1 : 0
            break
          case 'supervisor':
            aVal = a.supervisor ? `${a.supervisor.firstName || ''} ${a.supervisor.lastName || ''}`.toLowerCase() : ''
            bVal = b.supervisor ? `${b.supervisor.firstName || ''} ${b.supervisor.lastName || ''}`.toLowerCase() : ''
            break
          case 'defaultWorkspace':
            aVal = a.defaultWorkspace?.title?.toLowerCase() || ''
            bVal = b.defaultWorkspace?.title?.toLowerCase() || ''
            break
          default:
            return 0
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    
    return result
  }, [users, searchQuery, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredUsers.slice(start, start + pageSize)
  }, [filteredUsers, currentPage, pageSize])

  // Reset zones when dialog closes
  useEffect(() => {
    if (!isZoneDialogOpen) {
      setSelectedZoneIds([])
      hasSetInitialZones.current = false
      setZoneAssignUser(null)
    }
  }, [isZoneDialogOpen])

  // Reset workspaces when dialog closes
  useEffect(() => {
    if (!isWorkspaceDialogOpen) {
      setSelectedWorkspaceIds([])
      hasSetInitialWorkspaces.current = false
      setWorkspaceAssignUser(null)
    }
  }, [isWorkspaceDialogOpen])

  // Set selected zones when dialog opens or data loads
  useEffect(() => {
    if (isZoneDialogOpen && zoneAssignUser && !hasSetInitialZones.current) {
      const zonesToSet = zoneAssignUser.zones?.map(z => z.id) || userZoneIds
      setSelectedZoneIds(zonesToSet)
      hasSetInitialZones.current = true
    }
  }, [isZoneDialogOpen, zoneAssignUser, userZoneIds])

  // Set selected workspaces when dialog opens
  useEffect(() => {
    if (isWorkspaceDialogOpen && workspaceAssignUser && !hasSetInitialWorkspaces.current) {
      const workspacesToSet = workspaceAssignUser.workspaces?.map(w => w.id) || []
      setSelectedWorkspaceIds(workspacesToSet)
      hasSetInitialWorkspaces.current = true
    }
  }, [isWorkspaceDialogOpen, workspaceAssignUser])

  // Mutations
  const syncUsersMutation = useMutation({
    mutationFn: () => userManagementApi.syncKeycloakUsers(),
    onSuccess: (data) => {
      toast.success(`Synced ${data.syncedCount} new users, updated ${data.updatedCount} users`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const createUserMutation = useMutation({
    mutationFn: userManagementApi.createUser,
    onSuccess: () => {
      toast.success('User created successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const updateSupervisorMutation = useMutation({
    mutationFn: ({ userId, supervisorId }: { userId: number; supervisorId?: number }) =>
      userManagementApi.updateSupervisor(userId, { supervisorId }),
    onSuccess: () => {
      toast.success('Supervisor updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const assignRolesMutation = useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      userManagementApi.assignRolesToUser(userId, roleIds),
    onSuccess: () => {
      toast.success('Roles updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const assignGroupsMutation = useMutation({
    mutationFn: ({ userId, groupIds }: { userId: number; groupIds: number[] }) =>
      userManagementApi.assignGroupsToUser(userId, groupIds),
    onSuccess: () => {
      toast.success('Groups updated successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password, temporary }: { userId: string; password: string; temporary: boolean }) =>
      userManagementApi.resetPassword(userId, { password, temporary }),
    onSuccess: () => {
      toast.success('Password reset successfully')
      setIsPasswordDialogOpen(false)
      setResetPasswordUser(null)
      setNewPassword('')
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, enabled, disabledReason }: { userId: string; enabled: boolean; disabledReason?: string }) =>
      userManagementApi.toggleUserStatus(userId, enabled, disabledReason),
    onSuccess: (_, variables) => {
      toast.success(`User ${variables.enabled ? 'enabled' : 'disabled'} successfully`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const assignZonesMutation = useMutation({
    mutationFn: ({ userId, zoneIds }: { userId: string; zoneIds: number[] }) =>
      userManagementApi.assignZonesToUser(workspaceIdNum, userId, zoneIds),
    onSuccess: () => {
      toast.success('Zones assigned successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['user-zones'] })
      queryClient.invalidateQueries({ queryKey: ['zones-flat'] })
      setIsZoneDialogOpen(false)
      setZoneAssignUser(null)
      setSelectedZoneIds([])
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  const assignWorkspacesMutation = useMutation({
    mutationFn: ({ userId, workspaceIds }: { userId: number; workspaceIds: number[] }) =>
      userManagementApi.assignWorkspacesToUser(userId, workspaceIds),
    onSuccess: () => {
      toast.success('Workspaces assigned successfully')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsWorkspaceDialogOpen(false)
      setWorkspaceAssignUser(null)
      setSelectedWorkspaceIds([])
    },
    onError: (error: Error) => {
      toast.error(formatApiError(error))
    },
  })

  // Handlers
  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setSelectedRoleIds(user.roles?.map(r => r.id) || [])
      setSelectedGroupIds(user.groups?.map(g => g.id) || [])
      setSelectedSupervisorId(user.supervisorId || undefined)
    } else {
      setEditingUser(null)
      setFirstName('')
      setLastName('')
      setEmail('')
      setSelectedRoleIds([])
      setSelectedGroupIds([])
      setSelectedSupervisorId(undefined)
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingUser(null)
    setFirstName('')
    setLastName('')
    setEmail('')
  }

  const handleSave = async () => {
    if (editingUser) {
      try {
        await updateSupervisorMutation.mutateAsync({
          userId: editingUser.id,
          supervisorId: selectedSupervisorId,
        })
        await assignRolesMutation.mutateAsync({
          userId: editingUser.id,
          roleIds: selectedRoleIds,
        })
        await assignGroupsMutation.mutateAsync({
          userId: editingUser.id,
          groupIds: selectedGroupIds,
        })
        toast.success('User updated successfully')
        handleCloseDialog()
      } catch (error) {
        toast.error(formatApiError(error as Error))
      }
    } else {
      if (!email) {
        toast.error('Email is required')
        return
      }
      try {
        await createUserMutation.mutateAsync({
          firstName,
          lastName,
          email,
          supervisorId: selectedSupervisorId,
          roleIds: selectedRoleIds,
          groupIds: selectedGroupIds,
        })
        handleCloseDialog()
      } catch (error) {
        toast.error(formatApiError(error as Error))
      }
    }
  }

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }, [sortField, sortDirection])

  const getSortIcon = useCallback((field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline-block opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4 inline-block" />
      : <ArrowDown className="ml-2 h-4 w-4 inline-block" />
  }, [sortField, sortDirection])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1)
  }

  const handleExportCsv = () => {
    const headers = ['Name', 'Email', 'Status', 'Supervisor', 'Groups', 'Roles', 'Zones', 'Default Workspace', 'Workspaces']
    const rows = filteredUsers.map(user => [
      `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      user.email || '',
      user.enabled !== false ? 'Active' : 'Disabled',
      user.supervisor ? `${user.supervisor.firstName || ''} ${user.supervisor.lastName || ''}`.trim() : '',
      user.groups?.map(g => g.name).join(', ') || '',
      user.roles?.map(r => r.name).join(', ') || '',
      user.zones?.map(z => z.name).join(', ') || '',
      user.defaultWorkspace?.title || '',
      user.workspaces?.map(w => w.title).join(', ') || '',
    ])
    
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    toast.success('Users exported to CSV')
  }

  // Generate pagination page numbers
  const getPaginationPages = useCallback((current: number, total: number) => {
    const pages: (number | string)[] = []
    const maxVisible = 7
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      if (current > 3) pages.push('...')
      const start = Math.max(2, current - 1)
      const end = Math.min(total - 1, current + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (current < total - 2) pages.push('...')
      pages.push(total)
    }
    return pages
  }, [])

  // Render column header
  const renderColumnHeader = (column: string) => {
    if (column === 'actions') {
      return (
        <TableHead key={column} className="h-12 px-4 text-right sticky right-0 bg-muted z-20" style={{ width: 180 }}>
          Actions
        </TableHead>
      )
    }
    
    if (!columnVisibility[column as keyof typeof columnVisibility]) return null
    
    const def = COLUMN_DEFINITIONS[column as keyof typeof COLUMN_DEFINITIONS]
    if (!def) return null

    return (
      <TableHead 
        key={column} 
        className={`h-12 px-4 ${def.sortable ? 'cursor-pointer hover:bg-muted/80 select-none' : ''}`}
        style={{ width: def.defaultWidth }}
        onClick={def.sortable ? () => handleSort(column) : undefined}
      >
        <span className="flex items-center">
          {def.label}
          {def.sortable && getSortIcon(column)}
        </span>
      </TableHead>
    )
  }

  // Render table cell
  const renderTableCell = (column: string, user: User) => {
    if (column === 'actions') {
      return (
        <TableCell key={column} className="h-12 px-4 text-right sticky right-0 bg-background z-10">
          <div className="flex justify-end gap-1">
            <Button
              onClick={() => handleOpenDialog(user)}
              variant="ghost"
              size="icon"
              title="Edit user"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setResetPasswordUser(user)
                setIsPasswordDialogOpen(true)
                setNewPassword('')
                setTemporaryPassword(true)
              }}
              variant="ghost"
              size="icon"
              title="Reset password"
            >
              <Key className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setZoneAssignUser(user)
                setIsZoneDialogOpen(true)
              }}
              variant="ghost"
              size="icon"
              title="Assign zones"
            >
              <MapPin className="h-4 w-4 text-purple-600" />
            </Button>
            <Button
              onClick={() => {
                setWorkspaceAssignUser(user)
                setIsWorkspaceDialogOpen(true)
              }}
              variant="ghost"
              size="icon"
              title="Assign workspaces"
            >
              <Building2 className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              onClick={() => {
                if (user.keycloakUserId) {
                  userManagementApi.impersonateUser(user.keycloakUserId)
                    .then((response) => {
                      if (response.impersonationUrl) {
                        window.open(response.impersonationUrl, '_blank')
                        toast.success(`Impersonating ${user.firstName} ${user.lastName}`)
                      }
                    })
                    .catch((error) => {
                      toast.error(formatApiError(error))
                    })
                }
              }}
              variant="ghost"
              size="icon"
              title="Impersonate user"
            >
              <UserCog className="h-4 w-4 text-blue-600" />
            </Button>
            <Button
              onClick={() => {
                if (user.keycloakUserId) {
                  if (user.enabled === false) {
                    toggleUserStatusMutation.mutate({
                      userId: user.keycloakUserId,
                      enabled: true,
                    })
                  } else {
                    setUserToToggle(user)
                    setDisableReason('')
                    setIsDisableDialogOpen(true)
                  }
                }
              }}
              variant="ghost"
              size="icon"
              title={user.enabled !== false ? 'Disable user' : 'Enable user'}
              disabled={toggleUserStatusMutation.isPending}
            >
              {user.enabled !== false ? (
                <UserX className="h-4 w-4 text-red-600" />
              ) : (
                <UserCheck className="h-4 w-4 text-green-600" />
              )}
            </Button>
          </div>
        </TableCell>
      )
    }

    if (!columnVisibility[column as keyof typeof columnVisibility]) return null

    switch (column) {
      case 'name':
        return (
          <TableCell key={column} className="h-12 px-4 font-medium">
            {user.firstName || user.lastName
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
              : user.email}
          </TableCell>
        )
      case 'email':
        return <TableCell key={column} className="h-12 px-4">{user.email}</TableCell>
      case 'status':
        return (
          <TableCell key={column} className="h-12 px-4">
            <Badge 
              variant={user.enabled !== false ? "outline" : "secondary"}
              className={user.enabled !== false 
                ? "border-green-600 text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-400" 
                : "border-red-600 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-400"}
            >
              {user.enabled !== false ? 'Active' : 'Disabled'}
            </Badge>
          </TableCell>
        )
      case 'supervisor':
        return (
          <TableCell key={column} className="h-12 px-4">
            {user.supervisor ? (
              <span className="text-sm">
                {user.supervisor.firstName || user.supervisor.lastName
                  ? `${user.supervisor.firstName || ''} ${user.supervisor.lastName || ''}`.trim()
                  : user.supervisor.email}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">-</span>
            )}
          </TableCell>
        )
      case 'groups':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div className="flex flex-wrap gap-1">
              {user.groups?.length ? user.groups.map((group) => (
                <Badge key={group.id} variant="secondary" className="text-xs">
                  {group.name}
                </Badge>
              )) : <span className="text-muted-foreground text-sm">-</span>}
            </div>
          </TableCell>
        )
      case 'roles':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div className="flex flex-wrap gap-1">
              {user.roles?.length ? user.roles.map((role) => (
                <Badge key={role.id} variant="outline" className="text-xs">
                  {role.name}
                </Badge>
              )) : <span className="text-muted-foreground text-sm">-</span>}
            </div>
          </TableCell>
        )
      case 'zones':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div className="flex flex-wrap gap-1">
              {user.zones?.length ? user.zones.map((zone) => (
                <Badge key={zone.id} variant="secondary" className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: zone.color || '#3b82f6' }}
                  />
                  <span>{zone.name}</span>
                </Badge>
              )) : <span className="text-muted-foreground text-sm">-</span>}
            </div>
          </TableCell>
        )
      case 'defaultWorkspace':
        return (
          <TableCell key={column} className="h-12 px-4">
            {user.defaultWorkspace ? (
              <Badge variant="secondary" className="flex items-center gap-1.5 text-xs w-fit">
                <div
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: user.defaultWorkspace.color || '#3b82f6' }}
                />
                <span>{user.defaultWorkspace.title}</span>
              </Badge>
            ) : <span className="text-muted-foreground text-sm">-</span>}
          </TableCell>
        )
      case 'workspaces':
        return (
          <TableCell key={column} className="h-12 px-4">
            <div className="flex flex-wrap gap-1">
              {user.workspaces?.length ? user.workspaces.map((workspace) => (
                <Badge key={workspace.id} variant="outline" className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: workspace.color || '#3b82f6' }}
                  />
                  <span>{workspace.title}</span>
                </Badge>
              )) : <span className="text-muted-foreground text-sm">-</span>}
            </div>
          </TableCell>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-2 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage users and assign roles, groups, and supervisors</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-4"
            />
          </form>
          
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSearchInput('')
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Export">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem onClick={handleExportCsv}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" title="Toggle columns">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={columnVisibility[key as keyof typeof columnVisibility]}
                  onCheckedChange={(checked) => 
                    setColumnVisibility(prev => ({ ...prev, [key]: checked }))
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {def.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sync Keycloak */}
          <Button 
            onClick={() => syncUsersMutation.mutate()} 
            variant="outline"
            disabled={syncUsersMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {syncUsersMutation.isPending ? 'Syncing...' : 'Sync Keycloak'}
          </Button>

          {/* Refresh */}
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['users'] })
            }} 
            variant="outline" 
            size="icon"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>

          {/* Add User */}
          <Button onClick={() => handleOpenDialog()}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-hidden relative">
          {isLoading ? (
            <div className="overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow>
                    {columnOrder.filter(c => c === 'actions' || columnVisibility[c as keyof typeof columnVisibility]).map(col => (
                      <TableHead key={col} className="h-12 px-4">
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {columnOrder.filter(c => c === 'actions' || columnVisibility[c as keyof typeof columnVisibility]).map(col => (
                        <TableCell key={col} className="h-12 px-4">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-6 mb-4">
                <Users className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? 'No users found' : 'No users yet'}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {searchQuery 
                  ? 'Try adjusting your search criteria' 
                  : 'Get started by adding your first user or syncing from Keycloak'}
              </p>
              {!searchQuery && (
                <div className="flex gap-2">
                  <Button onClick={() => handleOpenDialog()}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                  <Button variant="outline" onClick={() => syncUsersMutation.mutate()}>
                    <Download className="mr-2 h-4 w-4" />
                    Sync Keycloak
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 270px)' }}>
              {isFetching && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                  <div className="bg-background p-4 rounded-lg shadow-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm font-medium">Refreshing...</span>
                    </div>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader className="sticky top-0 bg-muted z-10">
                  <TableRow className="hover:bg-muted">
                    {columnOrder.map(column => renderColumnHeader(column))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id} className={user.enabled === false ? 'opacity-60' : ''}>
                      {columnOrder.map(column => renderTableCell(column, user))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Per page</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-8 w-18 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="999999">All</SelectItem>

                    </SelectContent>
                  </Select>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-sm text-muted-foreground font-medium">
                  Showing {filteredUsers.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
                </div>
              </div>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {getPaginationPages(currentPage, totalPages).map((page, index) => (
                    typeof page === 'number' ? (
                      <Button
                        key={index}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ) : (
                      <span key={index} className="px-2 text-muted-foreground">...</span>
                    )
                  ))}
                  
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User Permissions' : 'Create New User'}</DialogTitle>
            <DialogDescription>
              {editingUser 
                ? "Update user's supervisor, roles, and groups" 
                : "Create a new user and assign supervisor, roles, and groups"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingUser ? (
              <div className="grid gap-2">
                <Label>User</Label>
                <div className="text-sm">
                  <div className="font-medium">
                    {editingUser.firstName || editingUser.lastName
                      ? `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim()
                      : 'N/A'}
                  </div>
                  <div className="text-muted-foreground">{editingUser.email}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                  />
                </div>
              </>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select
                value={selectedSupervisorId?.toString()}
                onValueChange={(value) => setSelectedSupervisorId(value ? parseInt(value) : undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a supervisor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => u.id !== editingUser?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.firstName || user.lastName 
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : user.email || 'Unknown'}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedSupervisorId && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedSupervisorId(undefined)}
                  className="text-xs w-fit"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear supervisor
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No groups available</p>
                ) : (
                  groups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroupIds.includes(group.id)}
                        onCheckedChange={(checked) => {
                          setSelectedGroupIds(
                            checked
                              ? [...selectedGroupIds, group.id]
                              : selectedGroupIds.filter(id => id !== group.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`group-${group.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {group.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Roles
              </Label>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                {roles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No roles available</p>
                ) : (
                  roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.includes(role.id)}
                        onCheckedChange={(checked) => {
                          setSelectedRoleIds(
                            checked
                              ? [...selectedRoleIds, role.id]
                              : selectedRoleIds.filter(id => id !== role.id)
                          )
                        }}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!editingUser && !email}>
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {resetPasswordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="temporary"
                checked={temporaryPassword}
                onCheckedChange={(checked) => setTemporaryPassword(checked as boolean)}
              />
              <label
                htmlFor="temporary"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Require password change on next login
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false)
                setResetPasswordUser(null)
                setNewPassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (resetPasswordUser && newPassword) {
                  resetPasswordMutation.mutate({
                    userId: resetPasswordUser.keycloakUserId || '',
                    password: newPassword,
                    temporary: temporaryPassword,
                  })
                }
              }}
              disabled={!newPassword || resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zone Assignment Dialog */}
      <Dialog open={isZoneDialogOpen} onOpenChange={setIsZoneDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Zones to User</DialogTitle>
            <DialogDescription>
              Select multiple zones for <strong>{zoneAssignUser?.firstName} {zoneAssignUser?.lastName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border rounded-md max-h-100 overflow-y-auto">
              <div className="p-2 space-y-1">
                {zones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No zones found
                  </div>
                ) : (
                  zones.map((zone) => (
                    <div
                      key={zone.id}
                      className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                      onClick={() => {
                        setSelectedZoneIds(prev =>
                          prev.includes(zone.id)
                            ? prev.filter(id => id !== zone.id)
                            : [...prev, zone.id]
                        )
                      }}
                    >
                      <Checkbox
                        checked={selectedZoneIds.includes(zone.id)}
                        onCheckedChange={() => {
                          setSelectedZoneIds(prev =>
                            prev.includes(zone.id)
                              ? prev.filter(id => id !== zone.id)
                              : [...prev, zone.id]
                          )
                        }}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: zone.color || '#3b82f6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{zone.name}</div>
                          {zone.description && (
                            <div className="text-sm text-muted-foreground truncate">
                              {zone.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selectedZoneIds.length} zone(s) selected</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedZoneIds([])}
                disabled={selectedZoneIds.length === 0}
              >
                Clear selection
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsZoneDialogOpen(false)
                setZoneAssignUser(null)
                setSelectedZoneIds([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (zoneAssignUser?.id) {
                  assignZonesMutation.mutate({
                    userId: zoneAssignUser.id.toString(),
                    zoneIds: selectedZoneIds,
                  })
                }
              }}
              disabled={assignZonesMutation.isPending}
            >
              {assignZonesMutation.isPending ? 'Assigning...' : 'Assign Zones'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Assignment Dialog */}
      <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Workspaces to User</DialogTitle>
            <DialogDescription>
              Select which workspaces <strong>{workspaceAssignUser?.firstName} {workspaceAssignUser?.lastName}</strong> can access
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border rounded-md max-h-100 overflow-y-auto">
              <div className="p-2 space-y-1">
                {availableWorkspaces.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No workspaces found
                  </div>
                ) : (
                  availableWorkspaces.map((workspace) => (
                    <div
                      key={workspace.id}
                      className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                      onClick={() => {
                        setSelectedWorkspaceIds(prev =>
                          prev.includes(workspace.id)
                            ? prev.filter(id => id !== workspace.id)
                            : [...prev, workspace.id]
                        )
                      }}
                    >
                      <Checkbox
                        checked={selectedWorkspaceIds.includes(workspace.id)}
                        onCheckedChange={() => {
                          setSelectedWorkspaceIds(prev =>
                            prev.includes(workspace.id)
                              ? prev.filter(id => id !== workspace.id)
                              : [...prev, workspace.id]
                          )
                        }}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="h-4 w-4 rounded-full shrink-0"
                          style={{ backgroundColor: workspace.color || '#3b82f6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{workspace.title}</div>
                          {workspace.location && (
                            <div className="text-sm text-muted-foreground truncate">
                              {workspace.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{selectedWorkspaceIds.length} workspace(s) selected</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedWorkspaceIds([])}
                disabled={selectedWorkspaceIds.length === 0}
              >
                Clear selection
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsWorkspaceDialogOpen(false)
                setWorkspaceAssignUser(null)
                setSelectedWorkspaceIds([])
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (workspaceAssignUser) {
                  assignWorkspacesMutation.mutate({
                    userId: workspaceAssignUser.id,
                    workspaceIds: selectedWorkspaceIds,
                  })
                }
              }}
              disabled={assignWorkspacesMutation.isPending}
            >
              {assignWorkspacesMutation.isPending ? 'Assigning...' : 'Assign Workspaces'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable User Confirmation Dialog */}
      <AlertDialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable{' '}
              <strong>
                {userToToggle?.firstName} {userToToggle?.lastName}
              </strong>
              ? This user will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="disable-reason">Reason (optional)</Label>
            <Textarea
              id="disable-reason"
              placeholder="Enter reason for disabling this user..."
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDisableDialogOpen(false)
                setUserToToggle(null)
                setDisableReason('')
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userToToggle?.keycloakUserId) {
                  toggleUserStatusMutation.mutate({
                    userId: userToToggle.keycloakUserId,
                    enabled: false,
                    disabledReason: disableReason || undefined,
                  })
                  setIsDisableDialogOpen(false)
                  setUserToToggle(null)
                  setDisableReason('')
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Disable User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
