import * as React from "react"
import { ChevronsUpDown, Check, Plus } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { workspaceApi, usersApi } from "@/lib/api"
import type { Workspace } from "@/lib/api"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function WorkspaceSwitcher() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentWorkspaceId, setCurrentWorkspaceId] = React.useState<number | null>(null)

  // Fetch all workspaces
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getAll(),
  })

  // Fetch current user to get their current workspace
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => usersApi.getCurrentUser(),
  })

  // Set workspace mutation
  const setWorkspaceMutation = useMutation({
    mutationFn: (workspaceId: number) => usersApi.setWorkspace(workspaceId, false),
    onSuccess: (_, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      setCurrentWorkspaceId(workspaceId)
      toast.success('Workspace switched successfully')
    },
    onError: () => {
      toast.error('Failed to switch workspace')
    },
  })

  // Get current workspace from user data or local state
  const activeWorkspace = React.useMemo(() => {
    if (currentWorkspaceId) {
      return workspaces.find(w => w.id === currentWorkspaceId)
    }
    // Try to get from current user data
    const userWorkspaceId = currentUser?.user?.currentWorkspaceId || currentUser?.user?.defaultWorkspaceId
    if (userWorkspaceId) {
      return workspaces.find(w => w.id === userWorkspaceId)
    }
    // Fallback to first workspace
    return workspaces[0]
  }, [currentWorkspaceId, workspaces, currentUser])

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    setWorkspaceMutation.mutate(workspace.id)
  }

  if (isLoading || workspaces.length === 0) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-semibold">
                  {activeWorkspace?.name?.substring(0, 2).toUpperCase() || 'WS'}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeWorkspace?.title || 'Select Workspace'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeWorkspace?.location || 'No location'}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleWorkspaceSwitch(workspace)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border" style={{ backgroundColor: workspace.color }}>
                  <span className="text-xs font-semibold text-white">
                    {workspace.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="font-medium">{workspace.title}</div>
                  <div className="text-xs text-muted-foreground">{workspace.location}</div>
                </div>
                {activeWorkspace?.id === workspace.id && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2 cursor-pointer"
              onClick={() => navigate('/workspace/view', { state: { openDialog: true } })}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add workspace</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
