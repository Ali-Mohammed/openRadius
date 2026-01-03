import { apiClient } from '../lib/api'

export interface RadiusUser {
  id?: number
  externalId?: number
  username: string
  firstname?: string
  lastname?: string
  city?: string
  phone?: string
  email?: string
  profileId?: number
  profileName?: string
  balance: number
  loanBalance?: number
  expiration?: string
  lastOnline?: string
  enabled: boolean
  onlineStatus?: number
  remainingDays?: number
  debtDays?: number
  staticIp?: string
  company?: string
  address?: string
  contractId?: string
  simultaneousSessions?: number
  createdAt?: string
  updatedAt?: string
  lastSyncedAt?: string
}

export interface SyncUsersResponse {
  syncId: string
  success: boolean
  message?: string
  totalUsers: number
  newUsers: number
  updatedUsers: number
  failedUsers: number
  startedAt: string
  completedAt?: string
  errorMessage?: string
}

export interface PaginatedUsersResponse {
  data: RadiusUser[]
  pagination: {
    currentPage: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export const radiusUserApi = {
  getAll: async (
    workspaceId: number, 
    page: number = 1, 
    pageSize: number = 50,
    search?: string
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (search) {
      params.append('search', search)
    }
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/users?${params.toString()}`)
    return response.data
  },

  getById: async (workspaceId: number, id: number): Promise<RadiusUser> => {
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/users/${id}`)
    return response.data
  },

  create: async (workspaceId: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/radius/users`, data)
    return response.data
  },

  update: async (workspaceId: number, id: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.put(`/api/workspaces/${workspaceId}/radius/users/${id}`, data)
    return response.data
  },

  delete: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.delete(`/api/workspaces/${workspaceId}/radius/users/${id}`)
  },

  restore: async (workspaceId: number, id: number): Promise<void> => {
    await apiClient.post(`/api/workspaces/${workspaceId}/radius/users/${id}/restore`)
  },

  getTrash: async (
    workspaceId: number,
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/workspaces/${workspaceId}/radius/users/trash?${params.toString()}`)
    return response.data
  },

  sync: async (workspaceId: number): Promise<SyncUsersResponse> => {
    const response = await apiClient.post(`/api/workspaces/${workspaceId}/radius/users/sync`)
    return response.data
  },
}

