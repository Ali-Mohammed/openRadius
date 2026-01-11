import { apiClient } from '../lib/api'

export interface RadiusTag {
  id: number
  title: string
  description?: string
  status: string
  color: string
  createdAt?: string
  updatedAt?: string
}

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
  tags?: RadiusTag[]
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
    page: number = 1, 
    pageSize: number = 50,
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    if (search) {
      params.append('search', search)
    }
    if (sortField) {
      params.append('sortField', sortField)
    }
    if (sortDirection) {
      params.append('sortDirection', sortDirection)
    }
    const response = await apiClient.get(`/api/radius/users?${params.toString()}`)
    return response.data
  },

  getById: async (id: number): Promise<RadiusUser> => {
    const response = await apiClient.get(`/api/radius/users/${id}`)
    return response.data
  },

  create: async (data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.post(`/api/radius/users`, data)
    return response.data
  },

  update: async (id: number, data: Partial<RadiusUser>): Promise<RadiusUser> => {
    const response = await apiClient.put(`/api/radius/users/${id}`, data)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/radius/users/${id}`)
  },

  restore: async (id: number): Promise<void> => {
    await apiClient.post(`/api/radius/users/${id}/restore`)
  },

  getTrash: async (
    page: number = 1,
    pageSize: number = 50
  ): Promise<PaginatedUsersResponse> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    })
    const response = await apiClient.get(`/api/radius/users/trash?${params.toString()}`)
    return response.data
  },

  sync: async (): Promise<SyncUsersResponse> => {
    const response = await apiClient.post(`/api/radius/users/sync`)
    return response.data
  },

  exportToCsv: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<Blob> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)
    
    const response = await apiClient.get(
      `/api/radius/users/export/csv?${params.toString()}`,
      { responseType: 'blob' }
    )
    return response.data
  },

  exportToExcel: async (
    search?: string,
    sortField?: string,
    sortDirection?: 'asc' | 'desc'
  ): Promise<Blob> => {
    const params = new URLSearchParams()
    if (search) params.append('search', search)
    if (sortField) params.append('sortField', sortField)
    if (sortDirection) params.append('sortDirection', sortDirection)
    
    const response = await apiClient.get(
      `/api/radius/users/export/excel?${params.toString()}`,
      { responseType: 'blob' }
    )
    return response.data
  },

  // Tag operations
  getUserTags: async (userId: number): Promise<RadiusTag[]> => {
    const response = await apiClient.get(`/api/radius/users/${userId}/tags`)
    return response.data
  },

  assignTags: async (userId: number, tagIds: number[]): Promise<void> => {
    await apiClient.post(`/api/radius/users/${userId}/tags`, tagIds)
  },
}

