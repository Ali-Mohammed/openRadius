import { apiClient } from '../lib/api'

export interface User {
  id: number
  keycloakUserId?: string
  firstName?: string
  lastName?: string
  email?: string
  enabled?: boolean
  supervisorId?: number
  supervisor?: {
    id: number
    firstName?: string
    lastName?: string
    email?: string
  }
  roles: Role[]
  groups: Group[]
}

export interface Role {
  id: number
  name: string
  description?: string
}

export interface Group {
  id: number
  name: string
  description?: string
}

export interface Permission {
  id: number
  name: string
  description?: string
  category: string
}

export interface CreatePermissionRequest {
  name: string
  description?: string
  category?: string
}

export interface CreateUserRequest {
  firstName?: string
  lastName?: string
  email?: string
  supervisorId?: number
  roleIds?: number[]
  groupIds?: number[]
}

export interface UpdateSupervisorRequest {
  supervisorId?: number
}

export interface CreateUserRoleRequest {
  name: string
  description?: string
}

export interface CreateUserGroupRequest {
  name: string
  description?: string
}

export interface SetPasswordRequest {
  password: string
  temporary?: boolean
}

export const userManagementApi = {
  // Sync Keycloak users
  syncKeycloakUsers: async (): Promise<{ message: string; syncedCount: number; updatedCount: number; totalProcessed: number }> => {
    const response = await apiClient.post('/api/user-management/sync-keycloak-users')
    return response.data
  },

  // User endpoints
  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get('/api/user-management')
    return response.data
  },

  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get(`/api/user-management/${id}`)
    return response.data
  },

  createUser: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post('/api/user-management', data)
    return response.data
  },

  updateSupervisor: async (id: number, data: UpdateSupervisorRequest): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/user-management/${id}/supervisor`, data)
    return response.data
  },

  // Role endpoints
  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get('/api/user-management/roles')
    return response.data
  },

  createRole: async (data: CreateUserRoleRequest): Promise<Role> => {
    const response = await apiClient.post('/api/user-management/roles', data)
    return response.data
  },

  deleteRole: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/user-management/roles/${id}`)
    return response.data
  },

  assignRolesToUser: async (userId: number, roleIds: number[]): Promise<{ message: string }> => {
    const response = await apiClient.post(`/api/user-management/${userId}/roles`, roleIds)
    return response.data
  },

  // Group endpoints
  getGroups: async (): Promise<Group[]> => {
    const response = await apiClient.get('/api/user-management/groups')
    return response.data
  },

  createGroup: async (data: CreateUserGroupRequest): Promise<Group> => {
    const response = await apiClient.post('/api/user-management/groups', data)
    return response.data
  },

  deleteGroup: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/user-management/groups/${id}`)
    return response.data
  },

  assignGroupsToUser: async (userId: number, groupIds: number[]): Promise<{ message: string }> => {
    const response = await apiClient.post(`/api/user-management/${userId}/groups`, groupIds)
    return response.data
  },

  // Permission endpoints
  getPermissions: async (): Promise<Permission[]> => {
    const response = await apiClient.get('/api/user-management/permissions')
    return response.data
  },

  createPermission: async (data: CreatePermissionRequest): Promise<Permission> => {
    const response = await apiClient.post('/api/user-management/permissions', data)
    return response.data
  },

  deletePermission: async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/user-management/permissions/${id}`)
    return response.data
  },

  getRolePermissions: async (roleId: number): Promise<Permission[]> => {
    const response = await apiClient.get(`/api/user-management/roles/${roleId}/permissions`)
    return response.data
  },

  assignPermissionsToRole: async (roleId: number, permissionIds: number[]): Promise<{ message: string }> => {
    const response = await apiClient.post(`/api/user-management/roles/${roleId}/permissions`, permissionIds)
    return response.data
  },

  // Password reset
  resetPassword: async (userId: string, data: SetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/keycloak/users/${userId}/reset-password`, data)
    return response.data
  },

  // Toggle user status
  toggleUserStatus: async (userId: string, enabled: boolean): Promise<{ message: string }> => {
    // First get the user details from Keycloak
    const userResponse = await apiClient.get(`/api/keycloak/users/${userId}`)
    const user = userResponse.data
    
    // Update in Keycloak (source of truth for user enabled status)
    await apiClient.put(`/api/keycloak/users/${userId}`, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      enabled: enabled,
      emailVerified: user.emailVerified,
    })
    
    return { message: 'User status updated successfully' }
  },

}
