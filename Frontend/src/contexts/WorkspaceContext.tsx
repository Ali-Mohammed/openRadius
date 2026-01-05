import React, { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/lib/api'
import { useKeycloak } from './KeycloakContext'

interface WorkspaceContextType {
  currentWorkspaceId: number | null
  setCurrentWorkspaceId: (id: number) => void
  isLoading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<number | null>(null) // Start with null
  const { authenticated } = useKeycloak()

  // Fetch current user to get their workspace - only when authenticated
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => usersApi.getCurrentUser(),
    enabled: authenticated, // Only fetch when authenticated
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent duplicate requests
    retry: false, // Don't retry on 401
  })

  // Update workspace ID when user data loads
  useEffect(() => {
    if (currentUser?.user) {
      const workspaceId = currentUser.user.currentWorkspaceId || currentUser.user.defaultWorkspaceId || 1
      setCurrentWorkspaceId(workspaceId)
    }
  }, [currentUser])

  return (
    <WorkspaceContext.Provider value={{ currentWorkspaceId, setCurrentWorkspaceId, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
