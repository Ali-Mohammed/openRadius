import { apiClient } from '../lib/api'

export interface KeycloakUser {
  id?: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  emailVerified?: boolean
  createdTimestamp?: number
  groups?: string[]
  realmRoles?: string[]
  attributes?: Record<string, string[]>
}

export interface CreateUserRequest {
  username: string
  email?: string
  firstName?: string
  lastName?: string
  enabled?: boolean
  emailVerified?: boolean
  groups?: string[]
  attributes?: Record<string, string[]>
  password?: string
  temporaryPassword?: boolean
}

export interface KeycloakGroup {
  id: string
  name: string
  path: string
}

export interface KeycloakRole {
  id: string
  name: string
  description?: string
  composite: boolean
  clientRole: boolean
}

export interface SetPasswordRequest {
  password: string
  temporary?: boolean
}

export const userManagementApi = {
  getAll: async (first?: number, max?: number, search?: string): Promise<KeycloakUser[]> => {
    const params = new URLSearchParams()
    if (first !== undefined) params.append('first', first.toString())
    if (max !== undefined) params.append('max', max.toString())
    if (search) params.append('search', search)
    
    const response = await apiClient.get(`/api/keycloak/users?${params.toString()}`)
    return response.data
  },

  getById: async (id: string): Promise<KeycloakUser> => {
    const response = await apiClient.get(`/api/keycloak/users/${id}`)
    return response.data
  },

  create: async (data: CreateUserRequest): Promise<{ id: string; message: string }> => {
    const response = await apiClient.post('/api/keycloak/users', data)
    return response.data
  },

  update: async (id: string, data: Partial<KeycloakUser>): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/keycloak/users/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/keycloak/users/${id}`)
    return response.data
  },

  resetPassword: async (id: string, data: SetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/keycloak/users/${id}/reset-password`, data)
    return response.data
  },

  getGroups: async (): Promise<KeycloakGroup[]> => {
    const response = await apiClient.get('/api/keycloak/users/groups')
    return response.data
  },

  getRoles: async (): Promise<KeycloakRole[]> => {
    const response = await apiClient.get('/api/keycloak/users/roles')
    return response.data
  },

  getUserRoles: async (id: string): Promise<string[]> => {
    const response = await apiClient.get(`/api/keycloak/users/${id}/roles`)
    return response.data
  },

  assignRoles: async (id: string, roleNames: string[]): Promise<{ message: string }> => {
    const response = await apiClient.post(`/api/keycloak/users/${id}/roles`, roleNames)
    return response.data
  },

  removeRoles: async (id: string, roleNames: string[]): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/keycloak/users/${id}/roles`, { data: roleNames })
    return response.data
  },

  getUserGroups: async (id: string): Promise<string[]> => {
    const response = await apiClient.get(`/api/keycloak/users/${id}/groups`)
    return response.data
  },

  addToGroup: async (id: string, groupId: string): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/keycloak/users/${id}/groups/${groupId}`)
    return response.data
  },

  removeFromGroup: async (id: string, groupId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/keycloak/users/${id}/groups/${groupId}`)
    return response.data
  },
}
