import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '../lib/api'
import { Loader2 } from 'lucide-react'

export const WorkspaceGuard = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // Fetch workspaces to check if user has any
  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceApi.getAll(),
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const { data: deletedWorkspaces = [] } = useQuery({
    queryKey: ['workspaces-deleted'],
    queryFn: () => workspaceApi.getDeleted(),
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  useEffect(() => {
    if (!isLoading) {
      const hasNoWorkspaces = workspaces.length === 0 && deletedWorkspaces.length === 0
      const isOnWorkspaceView = location.pathname === '/workspace/view'
      
      // If user has no workspaces and not already on workspace view, redirect
      if (hasNoWorkspaces && !isOnWorkspaceView) {
        navigate('/workspace/view', { replace: true })
      }
    }
  }, [workspaces, deletedWorkspaces, isLoading, location.pathname, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}
