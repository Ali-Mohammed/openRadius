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
    
    const response = await apiClient.get(`/api/users?${params.toString()}`)
    return response.data
  },

  getById: async (id: string): Promise<KeycloakUser> => {
    const response = await apiClient.get(`/api/users/${id}`)
    return response.data
  },

  create: async (data: CreateUserRequest): Promise<{ id: string; message: string }> => {
    const response = await apiClient.post('/api/users', data)
    return response.data
  },

  update: async (id: string, data: Partial<KeycloakUser>): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/users/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/users/${id}`)
    return response.data
  },

  resetPassword: async (id: string, data: SetPasswordRequest): Promise<{ message: string }> => {
    const response = await apiClient.put(`/api/users/${id}/reset-password`, data)
    return response.data
  },

  getGroups: async (): Promise<KeycloakGroup[]> => {
    const response = await apiClient.get('/api/users/groups')
    return response.data
  },
}
